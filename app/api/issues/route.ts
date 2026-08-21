import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { sync } from '@/ablo';
import { getViewer } from '@/lib/session';

/**
 * Creates an issue.
 *
 * The identifier is allocated here rather than on the client: it has to be
 * unique per organization, and two people pressing "create" at the same moment
 * must not land on the same number. A single UPDATE … RETURNING settles that in
 * the database instead of in a race between browsers.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const body = (await request.json()) as {
      teamId?: string;
      title?: string;
      description?: string;
      statusId?: string;
      assigneeId?: string | null;
      priority?: number;
      projectId?: string | null;
      cycleId?: string | null;
      parentIssueId?: string | null;
      labelIds?: string[];
      rank?: string;
   };

   const title = body.title?.trim();
   if (!title) return Response.json({ error: 'A title is required' }, { status: 400 });
   const teamId = body.teamId;
   if (!teamId || !viewer.teamIds.includes(teamId)) {
      return Response.json({ error: 'Not your team' }, { status: 403 });
   }

   if (!body.statusId) return Response.json({ error: 'A status is required' }, { status: 400 });

   const [team] = await db
      .select({ key: t.team.key, name: t.team.name, archivedAt: t.team.archivedAt })
      .from(t.team)
      .where(and(eq(t.team.id, teamId), eq(t.team.organizationId, viewer.organizationId)))
      .limit(1);
   if (!team) return Response.json({ error: 'Unknown team' }, { status: 404 });

   // A retired team keeps everything it has and takes nothing new. Enforced
   // here rather than only in the UI: hiding a button is not a rule.
   if (team.archivedAt) {
      return Response.json(
         { error: `${team.name} is retired, so it cannot take new issues` },
         { status: 409 }
      );
   }

   const relationError = await validateRelations(body, teamId, viewer.organizationId);
   if (relationError) return Response.json({ error: relationError }, { status: 400 });

   const number = await nextIssueNumber(teamId, viewer.organizationId);

   await sync.ready();
   const created = await sync.issue.create({
      data: {
         workspaceId: viewer.organizationId,
         teamId,
         identifier: `${team.key}-${number}`,
         title,
         description: body.description?.trim()
            ? JSON.stringify([{ type: 'paragraph', text: body.description.trim() }])
            : '',
         statusId: body.statusId,
         assigneeId: body.assigneeId ?? undefined,
         priority: body.priority ?? 0,
         projectId: body.projectId ?? undefined,
         cycleId: body.cycleId ?? undefined,
         parentIssueId: body.parentIssueId ?? undefined,
         labelIds: body.labelIds ?? [],
         // Newest first: the list sorts by rank descending.
         rank: body.rank ?? `z${Date.now().toString(36)}`,
      },
   });

   return Response.json({ id: created.id, identifier: `${team.key}-${number}` });
}

async function validateRelations(
   body: {
      statusId?: string;
      assigneeId?: string | null;
      projectId?: string | null;
      cycleId?: string | null;
      parentIssueId?: string | null;
      labelIds?: string[];
   },
   teamId: string,
   organizationId: string
): Promise<string | null> {
   const labelIds = [...new Set(body.labelIds ?? [])];
   const [status, assignee, project, cycle, parent, labels] = await Promise.all([
      db
         .select({ id: t.workflowState.id })
         .from(t.workflowState)
         .where(
            and(
               eq(t.workflowState.id, body.statusId!),
               eq(t.workflowState.organizationId, organizationId),
               or(isNull(t.workflowState.teamId), eq(t.workflowState.teamId, teamId))
            )
         )
         .limit(1),
      body.assigneeId
         ? db
              .select({ id: t.teamMember.userId })
              .from(t.teamMember)
              .innerJoin(
                 t.member,
                 and(
                    eq(t.member.userId, t.teamMember.userId),
                    eq(t.member.organizationId, organizationId)
                 )
              )
              .where(and(eq(t.teamMember.teamId, teamId), eq(t.teamMember.userId, body.assigneeId)))
              .limit(1)
         : Promise.resolve([]),
      body.projectId
         ? db
              .select({ id: t.project.id })
              .from(t.project)
              .where(
                 and(
                    eq(t.project.id, body.projectId),
                    eq(t.project.organizationId, organizationId),
                    eq(t.project.teamId, teamId)
                 )
              )
              .limit(1)
         : Promise.resolve([]),
      body.cycleId
         ? db
              .select({ id: t.cycle.id })
              .from(t.cycle)
              .where(
                 and(
                    eq(t.cycle.id, body.cycleId),
                    eq(t.cycle.organizationId, organizationId),
                    eq(t.cycle.teamId, teamId)
                 )
              )
              .limit(1)
         : Promise.resolve([]),
      body.parentIssueId
         ? db
              .select({ id: t.issue.id })
              .from(t.issue)
              .where(
                 and(
                    eq(t.issue.id, body.parentIssueId),
                    eq(t.issue.organizationId, organizationId),
                    eq(t.issue.teamId, teamId)
                 )
              )
              .limit(1)
         : Promise.resolve([]),
      labelIds.length
         ? db
              .select({ id: t.label.id })
              .from(t.label)
              .where(and(eq(t.label.organizationId, organizationId), inArray(t.label.id, labelIds)))
         : Promise.resolve([]),
   ]);

   if (!status.length) return 'That status is not available to this team';
   if (body.assigneeId && !assignee.length) return 'That assignee is not on this team';
   if (body.projectId && !project.length) return 'That project is not on this team';
   if (body.cycleId && !cycle.length) return 'That cycle is not on this team';
   if (body.parentIssueId && !parent.length) return 'That parent issue is not on this team';
   if (labels.length !== labelIds.length) return 'One or more labels are not in this workspace';
   return null;
}

/** Claims the next number for a team, creating the counter on first use. */
async function nextIssueNumber(teamId: string, organizationId: string): Promise<number> {
   const [claimed] = await db
      .insert(t.issueCounter)
      .values({ teamId, organizationId, next: 2 })
      .onConflictDoUpdate({
         target: t.issueCounter.teamId,
         set: { next: sql`${t.issueCounter.next} + 1` },
      })
      .returning({ next: t.issueCounter.next });

   // On insert the row starts at 2 and this issue takes 1; on update the value
   // returned is already incremented, so the issue takes the previous number.
   return claimed.next - 1;
}
