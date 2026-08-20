import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { loadRun, idempotencyKey } from '../lib/circle';

export default defineTool({
   description:
      'Answer in the conversation you were asked in. Use this for a chat run — a run with no issue attached — instead of post_update, which comments on an issue.',
   inputSchema: z.object({
      runId: z.string().describe('The run id from the message you were sent.'),
      body: z.string().describe('Your answer. Markdown-ish plain text.'),
   }),
   async execute({ runId, body }) {
      const context = await loadRun(runId);

      // The answer is a row, so it survives whether or not the request that
      // started the turn is still waiting. A long turn used to mean the reply
      // existed only in an HTTP response nobody was holding any more.
      await context.ablo.agentMessage.create({
         // Without this a retried reply is a second reply in the chat.
         idempotencyKey: idempotencyKey(runId, 'reply', body),
         data: {
            workspaceId: context.organizationId,
            teamId: context.teamId,
            runId,
            authorId: context.agentUserId,
            kind: 'result',
            body,
         },
      });

      return { replied: true };
   },
});
