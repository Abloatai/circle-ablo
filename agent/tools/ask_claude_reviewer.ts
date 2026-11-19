import { defineWorkflowTool } from 'eve/tools';
import { z } from 'zod';
import { reviewReportSchema } from '../lib/review-schema';

/**
 * Calls the `claude-reviewer` subagent and returns its structured report.
 *
 * eve 1 removed `outputSchema` from `defineAgent`; structured output from a
 * subagent is now requested per call through `ctx.agent`. This tool is how
 * the parent reaches it, so the report shape is still enforced.
 */
export default defineWorkflowTool({
   description:
      'Claude code-review specialist. Independently inspects an authorized pull request or challenges GPT’s findings with file-and-line evidence.',
   inputSchema: z.object({ message: z.string() }),
   async execute({ message }, ctx) {
      'use workflow';
      const response = await ctx.agent('claude-reviewer').send(message, {
         outputSchema: reviewReportSchema,
         signal: ctx.abortSignal,
      });
      const { data, status } = await response.result();
      if (status !== 'completed' || data === undefined) {
         throw new Error('claude-reviewer did not return a review report');
      }
      return data;
   },
});
