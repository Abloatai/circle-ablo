import { defineTool } from 'eve/tools';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { reviewAnalysis, reviewMission } from '../../db/schema/app';
import { normalizedConfidence, reviewFindingFingerprint } from '../../lib/domain/review-team';
import { idempotencyKey, loadRun, textBlocks } from '../lib/circle';
import { reconciledFindingSchema } from '../lib/review-schema';

export default defineTool({
   description:
      'Publish Scout’s reconciled verdict, evidence-backed findings, and issue comment for a completed cross-model review.',
   inputSchema: z.object({
      runId: z.string(),
      missionId: z.string(),
      verdict: z.enum(['approve', 'request_changes', 'comment']),
      summary: z.string(),
      confidence: z.number().min(0).max(1),
      findings: z.array(reconciledFindingSchema),
   }),
   async execute({ runId, missionId, verdict, summary, confidence, findings }) {
      const context = await loadRun(runId);
      if (!context.issueId) throw new Error('This run has no issue');
      const [mission] = await db
         .select({ id: reviewMission.id })
         .from(reviewMission)
         .where(
            and(
               eq(reviewMission.id, missionId),
               eq(reviewMission.organizationId, context.organizationId),
               eq(reviewMission.teamId, context.teamId),
               eq(reviewMission.issueId, context.issueId)
            )
         )
         .limit(1);
      if (!mission) throw new Error('Review mission is outside this run');

      for (const finding of findings) {
         const fingerprint = reviewFindingFingerprint({
            category: finding.category,
            title: finding.title,
            path: finding.path,
            line: finding.line,
         });
         await context.ablo.reviewFinding.create({
            idempotencyKey: idempotencyKey(runId, 'finding', fingerprint),
            data: {
               id: crypto.randomUUID(),
               workspaceId: context.organizationId,
               teamId: context.teamId,
               missionId,
               category: finding.category,
               severity: finding.severity,
               title: finding.title,
               body: finding.explanation,
               evidence: finding.evidence,
               path: finding.path,
               line: finding.line,
               raisedBy: finding.raisedBy,
               challengedBy: finding.challengedBy,
               resolution: finding.resolution,
               confidence: normalizedConfidence(finding.confidence),
               fingerprint,
            },
         });
      }

      const [synthesis] = await db
         .select({ id: reviewAnalysis.id })
         .from(reviewAnalysis)
         .where(
            and(
               eq(reviewAnalysis.missionId, missionId),
               eq(reviewAnalysis.model, 'scout'),
               eq(reviewAnalysis.phase, 'synthesis')
            )
         )
         .limit(1);
      if (synthesis) {
         await context.ablo.reviewAnalysis.update({
            id: synthesis.id,
            data: {
               status: 'succeeded',
               summary,
               recommendation: verdict,
               confidence,
               result: { findings: findings.length },
               finishedAt: new Date(),
            },
         });
      }

      await context.ablo.reviewMission.update({
         id: missionId,
         idempotencyKey: idempotencyKey(runId, 'mission', `${verdict}:${summary}`),
         data: {
            status: 'succeeded',
            phase: 'completed',
            verdict,
            summary,
            confidence,
            completedAt: new Date(),
         },
      });

      const heading =
         verdict === 'approve'
            ? 'Approve'
            : verdict === 'request_changes'
              ? 'Request changes'
              : 'Comment';
      const findingText = findings.length
         ? findings
              .map((finding, index) => {
                 const location = finding.path
                    ? ` (${finding.path}${finding.line ? `:${finding.line}` : ''})`
                    : '';
                 return `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}${location}\n${finding.explanation}\nEvidence: ${finding.evidence}`;
              })
              .join('\n\n')
         : 'No actionable findings survived cross-review.';
      const comment = `Cross-model review — ${heading}\n\n${summary}\n\n${findingText}\n\nGPT and Claude reviewed independently, challenged each other’s findings, and Scout reconciled the evidence.`;

      await context.ablo.comment.create({
         idempotencyKey: idempotencyKey(runId, 'review-team-comment', comment),
         data: {
            id: crypto.randomUUID(),
            workspaceId: context.organizationId,
            teamId: context.teamId,
            issueId: context.issueId,
            authorId: context.agentUserId,
            body: textBlocks(comment),
            reactions: {},
         },
      });
      await context.ablo.notification
         .create({
            idempotencyKey: idempotencyKey(runId, 'review-team-notify', missionId),
            data: {
               workspaceId: context.organizationId,
               userId: context.requestedById,
               type: 'comment',
               issueId: context.issueId,
               actorId: context.agentUserId,
            },
         })
         .catch(() => undefined);

      return { published: true, findings: findings.length };
   },
});
