import { defineTool } from 'eve/tools';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { reviewAnalysis, reviewMission } from '../../db/schema/app';
import { idempotencyKey, loadRun } from '../lib/circle';
import { reviewReportSchema } from '../lib/review-schema';

export default defineTool({
   description:
      'Update one durable stage in a Circle cross-model review. Mark it running before delegation and succeeded or failed afterward.',
   inputSchema: z.object({
      runId: z.string(),
      missionId: z.string(),
      model: z.enum(['gpt', 'claude', 'scout']),
      phase: z.enum(['independent', 'cross_review', 'synthesis']),
      status: z.enum(['running', 'succeeded', 'failed']),
      report: reviewReportSchema.optional(),
      error: z.string().optional(),
   }),
   async execute({ runId, missionId, model, phase, status, report, error }) {
      const context = await loadRun(runId);
      const [mission] = await db
         .select({ id: reviewMission.id })
         .from(reviewMission)
         .where(
            and(
               eq(reviewMission.id, missionId),
               eq(reviewMission.organizationId, context.organizationId),
               eq(reviewMission.teamId, context.teamId),
               eq(reviewMission.issueId, context.issueId ?? '')
            )
         )
         .limit(1);
      if (!mission) throw new Error('Review mission is outside this run');

      const [analysis] = await db
         .select({ id: reviewAnalysis.id })
         .from(reviewAnalysis)
         .where(
            and(
               eq(reviewAnalysis.missionId, missionId),
               eq(reviewAnalysis.model, model),
               eq(reviewAnalysis.phase, phase)
            )
         )
         .limit(1);
      if (!analysis) throw new Error(`No ${model} ${phase} stage exists`);

      const now = new Date();
      await context.ablo.reviewAnalysis.update({
         id: analysis.id,
         idempotencyKey: idempotencyKey(
            runId,
            `analysis:${model}:${phase}`,
            `${status}:${report?.summary ?? error ?? ''}`
         ),
         data: {
            status,
            ...(status === 'running' ? { startedAt: now } : { finishedAt: now }),
            ...(report
               ? {
                    summary: report.summary,
                    recommendation: report.recommendation,
                    confidence: report.confidence,
                    result: report,
                 }
               : error
                 ? { summary: error }
                 : {}),
         },
      });
      await context.ablo.reviewMission.update({
         id: missionId,
         data: {
            status: 'running',
            phase,
         },
      });
      return { updated: true };
   },
});
