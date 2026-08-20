import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { loadRun } from '../lib/circle';

export default defineTool({
   description:
      'Record that the work is finished. Call this last, after posting your findings as a comment.',
   inputSchema: z.object({
      runId: z.string(),
      result: z.string().describe('One or two sentences summarising the outcome.'),
      outcome: z.enum(['succeeded', 'failed', 'waiting']).default('succeeded'),
   }),
   async execute({ runId, result, outcome }) {
      const context = await loadRun(runId);
      await context.ablo.agentRun.update({
         id: runId,
         data: {
            status: outcome,
            result,
            currentStep: undefined,
            finishedAt: new Date(),
         },
      });
      return { recorded: outcome };
   },
});
