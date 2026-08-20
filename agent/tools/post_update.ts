import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { loadRun, reportStep, textBlocks } from '../lib/circle';

export default defineTool({
   description:
      'Post a comment on the issue as yourself. Use it to report findings, ask a question, or explain what you are about to do.',
   inputSchema: z.object({
      runId: z.string(),
      body: z.string().describe('Markdown-ish plain text. Blank lines separate paragraphs.'),
      step: z
         .string()
         .optional()
         .describe('Short status line shown next to the issue, e.g. "reading permit filings".'),
   }),
   async execute({ runId, body, step }) {
      const context = await loadRun(runId);
      if (!context.issueId) return { error: 'This run has no issue attached.' };

      await context.ablo.comment.create({
         data: {
            id: crypto.randomUUID(),
            workspaceId: context.organizationId,
            teamId: context.teamId,
            issueId: context.issueId,
            authorId: context.agentUserId,
            body: textBlocks(body),
            reactions: {},
         },
      });

      // The person who handed the work over hears about it, the way they would
      // if a colleague had commented.
      await context.ablo.notification
         .create({
            data: {
               workspaceId: context.organizationId,
               userId: context.requestedById,
               type: 'comment',
               issueId: context.issueId,
               actorId: context.agentUserId,
            },
         })
         .catch(() => undefined);

      if (step) await reportStep(context, step);
      return { posted: true };
   },
});
