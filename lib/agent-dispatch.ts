import 'server-only';

import { sync } from '@/ablo';
import { createAgentClient, findWorkspaceAgent } from '@/lib/agent-runtime';
import type { Viewer } from '@/lib/session';

export class AgentDispatchError extends Error {
   constructor(
      message: string,
      readonly status: number
   ) {
      super(message);
   }
}

/** Starts one issue-scoped agent run after repeating workspace and team authorization. */
export async function dispatchIssueAgent(input: {
   viewer: Viewer;
   issueId: string;
   agentUserId: string;
   prompt?: string;
}): Promise<{ runId: string; sessionId: string }> {
   await sync.ready();
   const issue = await sync.issue.get({ id: input.issueId });
   if (!issue) throw new AgentDispatchError('Unknown issue', 404);
   if (!input.viewer.teamIds.includes(issue.teamId)) {
      throw new AgentDispatchError('Not your team', 403);
   }

   const agent = await findWorkspaceAgent(
      input.viewer.organizationId,
      issue.teamId,
      input.agentUserId
   );
   if (!agent) throw new AgentDispatchError('That member is not an agent', 400);

   const request = input.prompt?.trim() || `${issue.title}\n\n${issue.description ?? ''}`.trim();
   const created = await sync.agentRun.create({
      data: {
         workspaceId: input.viewer.organizationId,
         agentUserId: agent,
         requestedById: input.viewer.id,
         issueId: issue.id,
         teamId: issue.teamId,
         status: 'queued',
         prompt: request,
         startedAt: new Date(),
      },
   });

   try {
      const client = createAgentClient();
      const { session } = await client.sessions.create({
         message: [
            `You have been assigned issue ${issue.identifier}.`,
            `runId: ${created.id}`,
            '',
            'Start with get_assignment.',
         ].join('\n'),
      });

      await sync.agentRun.update({
         id: created.id,
         data: { status: 'running', sessionId: session.state.sessionId },
      });
      return { runId: created.id, sessionId: session.state.sessionId };
   } catch (error) {
      await sync.agentRun.update({
         id: created.id,
         data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Could not reach the agent runtime',
            finishedAt: new Date(),
         },
      });
      throw new AgentDispatchError('Could not start the agent', 502);
   }
}
