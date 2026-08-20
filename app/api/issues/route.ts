import { and, eq, sql } from 'drizzle-orm';
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
      .select({ key: t.team.key })
      .from(t.team)
      .where(and(eq(t.team.id, teamId), eq(t.team.organizationId, viewer.organizationId)))
      .limit(1);
   if (!team) return Response.json({ error: 'Unknown team' }, { status: 404 });

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
