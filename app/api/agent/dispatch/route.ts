import { sync } from '@/ablo';
import { createAgentClient, findWorkspaceAgent } from '@/lib/agent-runtime';
import { getViewer } from '@/lib/session';

/**
 * Hands an issue to an agent.
 *
 * The run row is the agent's authority: it is written here, from a request we
 * have already authenticated, and the agent's tools derive their scope from it.
 * Nothing the model says can widen that, because the model only ever sees the
 * run id.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { issueId, agentUserId, prompt } = (await request.json()) as {
      issueId?: string;
      agentUserId?: string;
      prompt?: string;
   };
   if (!issueId || !agentUserId) {
      return Response.json({ error: 'issueId and agentUserId are required' }, { status: 400 });
   }

   await sync.ready();
   const issue = await sync.issue.get({ id: issueId });
   if (!issue) return Response.json({ error: 'Unknown issue' }, { status: 404 });

   // The viewer must be on the issue's team, and the target must be an agent.
   if (!viewer.teamIds.includes(issue.teamId)) {
      return Response.json({ error: 'Not your team' }, { status: 403 });
   }
   const agent = await findWorkspaceAgent(viewer.organizationId, issue.teamId, agentUserId);
   if (!agent) {
      return Response.json({ error: 'That member is not an agent' }, { status: 400 });
   }

   const request_ = prompt?.trim() || `${issue.title}\n\n${issue.description ?? ''}`.trim();

   // Written through Ablo, so the run appears live for everyone watching the
   // team the moment it is created.
   // The id comes back from the write: Ablo assigns its own and ignores the one
   // you pass, so anything that reuses it has to read it off the created row.
   const created = await sync.agentRun.create({
      data: {
         workspaceId: viewer.organizationId,
         agentUserId,
         requestedById: viewer.id,
         issueId,
         teamId: issue.teamId,
         status: 'queued',
         prompt: request_,
         startedAt: new Date(),
      },
   });
   const runId = created.id;

   try {
      const client = createAgentClient();
      const { session } = await client.sessions.create({
         message: [
            `You have been assigned issue ${issue.identifier}.`,
            `runId: ${runId}`,
            '',
            'Start with get_assignment.',
         ].join('\n'),
      });

      // The run continues inside eve; we only record where to find it.
      await sync.agentRun.update({
         id: runId,
         data: { status: 'running', sessionId: session.state.sessionId },
      });

      return Response.json({ runId, sessionId: session.state.sessionId });
   } catch (error) {
      await sync.agentRun.update({
         id: runId,
         data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Could not reach the agent runtime',
            finishedAt: new Date(),
         },
      });
      return Response.json({ error: 'Could not start the agent' }, { status: 502 });
   }
}
