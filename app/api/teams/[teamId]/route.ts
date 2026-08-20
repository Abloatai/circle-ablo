import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getViewer } from '@/lib/session';

/**
 * Retiring, restoring and deleting a team.
 *
 * Both are the caller's own workspace only. Circle has no role gating anywhere
 * else — every member can already delete an issue or edit a workflow state — so
 * gating these on `owner` would be inconsistent with the rest of the app and
 * untestable against a seed where everyone is a `member`. The protection is the
 * confirmation, not a role: retiring is reversible, and deleting asks for the
 * team's name to be typed.
 */
type Loaded =
   | { error: Response; viewer?: undefined; team?: undefined }
   | {
        error?: undefined;
        viewer: NonNullable<Awaited<ReturnType<typeof getViewer>>>;
        team: { id: string; name: string; archivedAt: Date | null };
     };

async function loadTeam(teamId: string): Promise<Loaded> {
   const viewer = await getViewer();
   if (!viewer) return { error: Response.json({ error: 'Not signed in' }, { status: 401 }) };

   const [team] = await db
      .select({ id: t.team.id, name: t.team.name, archivedAt: t.team.archivedAt })
      .from(t.team)
      .where(and(eq(t.team.id, teamId), eq(t.team.organizationId, viewer.organizationId)))
      .limit(1);
   if (!team) return { error: Response.json({ error: 'No such team' }, { status: 404 }) };

   return { viewer, team };
}

/** Retire (`{ archived }`), bring back, or set the `description`. */
export async function PATCH(
   request: Request,
   { params }: { params: Promise<{ teamId: string }> }
): Promise<Response> {
   const { teamId } = await params;
   const loaded = await loadTeam(teamId);
   if (loaded.error) return loaded.error;

   const body = (await request.json().catch(() => ({}))) as {
      archived?: boolean;
      description?: string | null;
   };

   if (typeof body.archived === 'boolean') {
      await db
         .update(t.team)
         .set({ archivedAt: body.archived ? new Date() : null })
         .where(eq(t.team.id, teamId));
      return Response.json({ ok: true, archived: body.archived });
   }

   if (body.description !== undefined) {
      const next = body.description?.trim() ?? '';
      await db
         .update(t.team)
         // Empty means cleared, not an empty string sitting where a
         // description used to be.
         .set({ description: next.length > 0 ? next : null })
         .where(eq(t.team.id, teamId));
      return Response.json({ ok: true });
   }

   return Response.json({ error: 'Nothing to update' }, { status: 400 });
}

/**
 * Deletes a team and everything scoped to it.
 *
 * Eighteen tables carry a `team_id` and none of them has a foreign key to
 * `team`, so each is cleared explicitly — a cascade would not do it. The work
 * runs in one transaction: a half-deleted team is worse than either outcome.
 *
 * These deletes go straight to Postgres rather than through Ablo, which is the
 * same exception `db/seed.ts` uses for bulk work. Ablo picks the rows up over
 * the WAL, so clients still see them disappear; sending thousands of individual
 * deletes through the write path would take minutes for no extra guarantee.
 *
 * `team_member` is left to its foreign key, which cascades.
 */
export async function DELETE(
   request: Request,
   { params }: { params: Promise<{ teamId: string }> }
): Promise<Response> {
   const { teamId } = await params;
   const loaded = await loadTeam(teamId);
   if (loaded.error) return loaded.error;
   const { team } = loaded;

   // Typing the name is the guard. It is the only irreversible action here.
   const body = (await request.json().catch(() => ({}))) as { confirm?: string };
   if (body.confirm?.trim() !== team.name) {
      return Response.json(
         { error: `Type the team's name exactly to confirm: ${team.name}` },
         { status: 400 }
      );
   }

   const deleted = await db.transaction(async (tx) => {
      // Issue-scoped rows first: they are found through the issues, and some
      // carry no team_id of their own.
      const issues = await tx
         .select({ id: t.issue.id })
         .from(t.issue)
         .where(eq(t.issue.teamId, teamId));
      const issueIds = issues.map((row) => row.id);

      if (issueIds.length > 0) {
         await tx.delete(t.issueActivity).where(inArray(t.issueActivity.issueId, issueIds));
         await tx.delete(t.comment).where(inArray(t.comment.issueId, issueIds));
         await tx.delete(t.issueLink).where(inArray(t.issueLink.issueId, issueIds));
         await tx.delete(t.issuePullRequest).where(inArray(t.issuePullRequest.issueId, issueIds));
      }

      const projects = await tx
         .select({ id: t.project.id })
         .from(t.project)
         .where(eq(t.project.teamId, teamId));
      const projectIds = projects.map((row) => row.id);
      if (projectIds.length > 0) {
         await tx.delete(t.projectLabel).where(inArray(t.projectLabel.projectId, projectIds));
         await tx
            .delete(t.projectMilestone)
            .where(inArray(t.projectMilestone.projectId, projectIds));
         await tx.delete(t.projectUpdate).where(inArray(t.projectUpdate.projectId, projectIds));
         await tx.delete(t.projectResource).where(inArray(t.projectResource.projectId, projectIds));
      }

      await tx.delete(t.agentMessage).where(eq(t.agentMessage.teamId, teamId));
      await tx.delete(t.agentRun).where(eq(t.agentRun.teamId, teamId));
      await tx.delete(t.document).where(eq(t.document.teamId, teamId));
      await tx.delete(t.documentFolder).where(eq(t.documentFolder.teamId, teamId));
      await tx.delete(t.savedView).where(eq(t.savedView.teamId, teamId));
      await tx.delete(t.issue).where(eq(t.issue.teamId, teamId));
      await tx.delete(t.issueCounter).where(eq(t.issueCounter.teamId, teamId));
      await tx.delete(t.cycle).where(eq(t.cycle.teamId, teamId));
      await tx.delete(t.project).where(eq(t.project.teamId, teamId));
      await tx.delete(t.workflowState).where(eq(t.workflowState.teamId, teamId));

      // Cascades to team_member.
      await tx.delete(t.team).where(eq(t.team.id, teamId));

      return { issues: issueIds.length, projects: projectIds.length };
   });

   return Response.json({ ok: true, ...deleted });
}
