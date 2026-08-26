'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GitHubApiError } from '@/lib/github/app';
import { deployReviewTeamToCodeReview, submitCodeReview } from '@/lib/github/reviews';
import { getViewer } from '@/lib/session';

const reviewInput = z.object({
   orgId: z.string().min(1),
   reviewId: z.string().min(1),
   event: z.enum(['COMMENT', 'APPROVE', 'REQUEST_CHANGES']),
   body: z.string().max(10_000),
});

const scoutInput = reviewInput.pick({ orgId: true, reviewId: true });

export async function deployReviewTeamAction(input: unknown): Promise<{
   ok: boolean;
   error?: string;
   issueId?: string;
   identifier?: string;
   createdIssue?: boolean;
   alreadyRunning?: boolean;
   missionId?: string;
}> {
   const parsed = scoutInput.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'The review-team request is invalid.' };

   const viewer = await getViewer();
   if (!viewer) return { ok: false, error: 'Sign in before deploying the review team.' };
   if (viewer.organizationSlug !== parsed.data.orgId) {
      return { ok: false, error: 'That pull request is outside your workspace.' };
   }

   try {
      const deployed = await deployReviewTeamToCodeReview({
         viewer,
         reviewId: parsed.data.reviewId,
      });
      revalidatePath(`/${parsed.data.orgId}/reviews`);
      revalidatePath(`/${parsed.data.orgId}/review/${parsed.data.reviewId}`);
      revalidatePath(`/${parsed.data.orgId}/issue/${deployed.issueId}`);
      return {
         ok: true,
         issueId: deployed.issueId,
         identifier: deployed.identifier,
         createdIssue: deployed.createdIssue,
         alreadyRunning: deployed.alreadyRunning,
         missionId: deployed.missionId,
      };
   } catch (error) {
      return {
         ok: false,
         error: error instanceof Error ? error.message : 'Could not deploy the review team.',
      };
   }
}

export async function submitPullRequestReviewAction(input: unknown): Promise<{
   ok: boolean;
   error?: string;
}> {
   const parsed = reviewInput.safeParse(input);
   if (!parsed.success) return { ok: false, error: 'The review request is invalid.' };

   const viewer = await getViewer();
   if (!viewer) return { ok: false, error: 'Sign in before submitting a review.' };
   if (viewer.organizationSlug !== parsed.data.orgId) {
      return { ok: false, error: 'That pull request is outside your workspace.' };
   }

   try {
      await submitCodeReview({
         viewer,
         reviewId: parsed.data.reviewId,
         event: parsed.data.event,
         body: parsed.data.body,
      });
      revalidatePath(`/${parsed.data.orgId}/reviews`);
      revalidatePath(`/${parsed.data.orgId}/reviews/created`);
      revalidatePath(`/${parsed.data.orgId}/review/${parsed.data.reviewId}`);
      return { ok: true };
   } catch (error) {
      if (error instanceof GitHubApiError && error.status === 403) {
         return {
            ok: false,
            error: 'GitHub denied the review. Set the App’s Pull requests permission to Read and write, then approve the permission update.',
         };
      }
      return {
         ok: false,
         error: error instanceof Error ? error.message : 'Could not submit the review.',
      };
   }
}
