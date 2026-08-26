import { z } from 'zod';

export const reviewerFindingSchema = z.object({
   category: z.enum(['correctness', 'security', 'tests', 'performance', 'maintainability']),
   severity: z.enum(['blocker', 'high', 'medium', 'low']),
   title: z.string(),
   explanation: z.string(),
   evidence: z.string(),
   path: z.string().optional(),
   line: z.number().int().positive().optional(),
   confidence: z.number().min(0).max(1),
});

export const reviewReportSchema = z.object({
   summary: z.string(),
   recommendation: z.enum(['approve', 'request_changes', 'comment']),
   confidence: z.number().min(0).max(1),
   findings: z.array(reviewerFindingSchema),
});

export const reconciledFindingSchema = reviewerFindingSchema.extend({
   raisedBy: z.array(z.enum(['gpt', 'claude'])).min(1),
   challengedBy: z.array(z.enum(['gpt', 'claude'])),
   resolution: z.enum(['confirmed', 'disputed']),
});

export type ReviewReport = z.infer<typeof reviewReportSchema>;
