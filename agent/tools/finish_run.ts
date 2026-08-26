import { defineTool } from 'eve/tools';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { reviewMission } from '../../db/schema/app';
import { idempotencyKey, loadRun, textBlocks } from '../lib/circle';

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
      const [mission] = await db
         .select({ id: reviewMission.id })
         .from(reviewMission)
         .where(
            and(
               eq(reviewMission.agentRunId, runId),
               eq(reviewMission.organizationId, context.organizationId),
               ne(reviewMission.status, 'succeeded')
            )
         )
         .limit(1);
      if (mission) {
         await context.ablo.reviewMission.update({
            id: mission.id,
            data: {
               // A successful review-team run must publish its verdict first.
               // Finishing without that durable result is a failed protocol.
               status: outcome === 'succeeded' ? 'failed' : outcome,
               summary: result,
               ...(outcome === 'failed' ? { completedAt: new Date() } : {}),
            },
         });

         // Review missions deliberately do not post intermediate chatter. A
         // terminal failure still needs one durable, visible explanation on
         // the linked issue; otherwise the user sees an issue appear and no
         // evidence that the review actually ran.
         if (outcome === 'failed' && context.issueId) {
            const body = `Cross-model review failed\n\n${result}\n\nDeploy the review team again to retry.`;
            await context.ablo.comment.create({
               idempotencyKey: idempotencyKey(runId, 'review-team-failed', body),
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
            await context.ablo.notification
               .create({
                  idempotencyKey: idempotencyKey(runId, 'review-team-failed-notify', mission.id),
                  data: {
                     workspaceId: context.organizationId,
                     userId: context.requestedById,
                     type: 'comment',
                     issueId: context.issueId,
                     actorId: context.agentUserId,
                  },
               })
               .catch(() => undefined);
         }
      }
      return { recorded: outcome };
   },
});
