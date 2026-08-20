import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { idempotencyKey, loadRun } from '../lib/circle';

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
         // Retried by eve when a connection drops; without a key the second
         // attempt is a second commit rather than the same one.
         idempotencyKey: idempotencyKey(runId, 'finish', outcome),
         data: {
            status: outcome,
            result,
            // `null`, not `undefined`. An `undefined` is dropped from the
            // payload rather than written, so the run kept advertising the step
            // it was on when it finished — two runs in this database still say
            // "summarising request" while reading as succeeded.
            //
            // The generated type spells the field `string | undefined`, which
            // cannot say "clear this", so the payload is widened the same way
            // `use-label-actions` widens ungrouping a label.
            currentStep: null,
            finishedAt: new Date(),
         } as unknown as Record<string, never>,
      });
      return { recorded: outcome };
   },
});
