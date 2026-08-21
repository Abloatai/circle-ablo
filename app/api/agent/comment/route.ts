import { and, desc, eq } from 'drizzle-orm';
import { sync } from '@/ablo';
import { db } from '@/db';
import * as t from '@/db/schema';
import { createAgentClient, findWorkspaceAgent } from '@/lib/agent-runtime';
import { canResumeIssueRun } from '@/lib/domain/agent-runs';
import { getViewer } from '@/lib/session';

/**
 * Delivers a newly committed issue comment to the agent assigned to the issue.
 *
 * Comments remain the durable source of truth. This route only wakes the Eve
 * session and tells Scout to read the discussion again, so a dropped request
 * cannot lose what the person wrote and no browser-provided text is trusted.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { commentId } = (await request.json()) as { commentId?: string };
   if (!commentId) return Response.json({ error: 'commentId is required' }, { status: 400 });

   const [entry] = await db
      .select({
         commentCreatedAt: t.comment.createdAt,
         identifier: t.issue.identifier,
         issueId: t.issue.id,
         teamId: t.issue.teamId,
         assigneeId: t.issue.assigneeId,
      })
      .from(t.comment)
      .innerJoin(t.issue, eq(t.issue.id, t.comment.issueId))
      .where(
         and(
            eq(t.comment.id, commentId),
            eq(t.comment.authorId, viewer.id),
            eq(t.comment.organizationId, viewer.organizationId),
            eq(t.issue.organizationId, viewer.organizationId)
         )
      )
      .limit(1);

   if (!entry) return Response.json({ error: 'Unknown comment' }, { status: 404 });
   if (!viewer.teamIds.includes(entry.teamId)) {
      return Response.json({ error: 'Not your team' }, { status: 403 });
   }

   // Most issue comments are ordinary teammate discussion. Only an agent that
   // is still the assignee gets woken up.
   if (!entry.assigneeId) return new Response(null, { status: 204 });
   const agentId = await findWorkspaceAgent(viewer.organizationId, entry.teamId, entry.assigneeId);
   if (!agentId) return new Response(null, { status: 204 });

   // Use the latest assignment, even when an older run still has a live
   // session. Falling back to an old run would revive stale instructions after
   // a newer assignment failed or was canceled.
   const [run] = await db
      .select()
      .from(t.agentRun)
      .where(
         and(
            eq(t.agentRun.organizationId, viewer.organizationId),
            eq(t.agentRun.issueId, entry.issueId),
            eq(t.agentRun.teamId, entry.teamId),
            eq(t.agentRun.agentUserId, agentId)
         )
      )
      .orderBy(desc(t.agentRun.createdAt))
      .limit(1);

   if (
      !run ||
      !canResumeIssueRun(run) ||
      // Do not let a replayed id for a comment that predates the assignment
      // create a duplicate turn.
      entry.commentCreatedAt < run.createdAt
   ) {
      return new Response(null, { status: 204 });
   }

   try {
      const client = createAgentClient();
      await client.sessions.attach(run.sessionId).send(
         [
            `A teammate added a new comment to issue ${entry.identifier}.`,
            `runId: ${run.id}`,
            '',
            'Call get_assignment again to read the updated discussion, then continue the work and reply in the issue comments.',
         ].join('\n'),
         // A comment is live conversation. If Scout is mid-turn, make the new
         // context available now instead of silently queueing it behind work
         // that may already be based on missing information.
         { turnPolicy: 'steer' }
      );

      await sync.ready();
      await sync.agentRun.update({
         id: run.id,
         data: {
            status: 'running',
            requestedById: viewer.id,
            currentStep: 'reading your reply',
            // A succeeded/waiting run is active again. These nullable clears
            // are valid writes even though the generated update type cannot
            // express them yet.
            finishedAt: null,
            error: null,
         } as unknown as Record<string, never>,
      });

      return Response.json({ resumed: true, runId: run.id });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the agent runtime';
      return Response.json({ error: message }, { status: 502 });
   }
}
