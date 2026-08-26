import { AgentDispatchError, dispatchIssueAgent } from '@/lib/agent-dispatch';
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

   try {
      return Response.json(await dispatchIssueAgent({ viewer, issueId, agentUserId, prompt }));
   } catch (error) {
      const status = error instanceof AgentDispatchError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Could not start the agent';
      return Response.json({ error: message }, { status });
   }
}
