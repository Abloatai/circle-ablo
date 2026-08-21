import { and, eq } from 'drizzle-orm';
import { sync } from '@/ablo';
import { db } from '@/db';
import * as t from '@/db/schema';
import { GitHubApiError, mergePullRequest } from '@/lib/github/app';
import { verifyGitHubMergeApproval } from '@/lib/github/merge-approval-signature';
import {
   GITHUB_MERGE_REQUEST_KIND,
   parseGitHubMergeRequestPayload,
   type GitHubMergeRequestPayload,
} from '@/lib/github/merge-request';
import { canManageWorkspace, getViewer } from '@/lib/session';

const failureMessage = (error: unknown): string => {
   if (error instanceof GitHubApiError) {
      if (error.status === 403) {
         return 'GitHub refused the merge. Check the App Contents permission and branch rules.';
      }
      if (error.status === 405) return 'This pull request is not currently mergeable.';
      if (error.status === 409) return error.message;
   }
   return error instanceof Error ? error.message : 'Could not merge the pull request.';
};

/**
 * Complete one merge approval.
 *
 * The browser supplies only an activity id. URL, team, merge method, and SHA
 * are reloaded from the authenticated workspace row, then the GitHub helper
 * repeats repository authorization before it writes.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });
   if (!canManageWorkspace(viewer)) {
      return Response.json({ error: 'Workspace admin approval is required' }, { status: 403 });
   }

   const { activityId } = (await request.json()) as { activityId?: string };
   if (!activityId) return Response.json({ error: 'activityId is required' }, { status: 400 });

   const [activity] = await db
      .select({
         id: t.issueActivity.id,
         type: t.issueActivity.type,
         payload: t.issueActivity.payload,
         issueId: t.issue.id,
         teamId: t.issue.teamId,
      })
      .from(t.issueActivity)
      .innerJoin(t.issue, eq(t.issue.id, t.issueActivity.issueId))
      .where(
         and(eq(t.issueActivity.id, activityId), eq(t.issue.organizationId, viewer.organizationId))
      )
      .limit(1);
   if (!activity) return Response.json({ error: 'Merge request not found' }, { status: 404 });
   if (activity.type !== GITHUB_MERGE_REQUEST_KIND || !activity.teamId) {
      return Response.json({ error: 'That activity is not a merge request' }, { status: 400 });
   }

   const payload = parseGitHubMergeRequestPayload(activity.payload);
   if (!payload) return Response.json({ error: 'The merge request is invalid' }, { status: 400 });
   if (!verifyGitHubMergeApproval(payload)) {
      return Response.json({ error: 'The merge request did not come from Scout' }, { status: 403 });
   }
   if (payload.status === 'merged') {
      return Response.json({ merged: true, sha: payload.mergedSha, alreadyMerged: true });
   }

   await sync.ready();
   try {
      const result = await mergePullRequest({
         organizationId: viewer.organizationId,
         teamId: activity.teamId,
         url: payload.url,
         expectedHeadSha: payload.headSha,
         mergeMethod: payload.mergeMethod,
      });
      const withoutError: GitHubMergeRequestPayload = { ...payload };
      delete withoutError.error;
      const mergedPayload: GitHubMergeRequestPayload = {
         ...withoutError,
         text: `${viewer.name} approved and merged ${payload.repository}#${payload.pullNumber}`,
         status: 'merged',
         approvedById: viewer.id,
         approvedByName: viewer.name,
         mergedAt: new Date().toISOString(),
         mergedSha: result.sha,
      };
      await sync.issueActivity.update({
         id: activity.id,
         data: { payload: mergedPayload },
      });

      const linked = await db
         .select({ id: t.issuePullRequest.id })
         .from(t.issuePullRequest)
         .where(
            and(
               eq(t.issuePullRequest.organizationId, viewer.organizationId),
               eq(t.issuePullRequest.issueId, activity.issueId),
               eq(t.issuePullRequest.url, payload.url)
            )
         );
      await Promise.all(
         linked.map((pullRequest) =>
            sync.issuePullRequest.update({ id: pullRequest.id, data: { state: 'merged' } })
         )
      );

      return Response.json({
         merged: true,
         sha: result.sha,
         alreadyMerged: result.alreadyMerged,
      });
   } catch (error) {
      const message = failureMessage(error);
      const failedPayload: GitHubMergeRequestPayload = {
         ...payload,
         text: `could not merge ${payload.repository}#${payload.pullNumber}: ${message}`,
         status: 'failed',
         error: message,
      };
      try {
         await sync.issueActivity.update({
            id: activity.id,
            data: { payload: failedPayload },
         });
      } catch (updateError) {
         console.error('[github] could not record failed merge approval', updateError);
      }
      const status = error instanceof GitHubApiError && error.status < 500 ? error.status : 502;
      return Response.json({ error: message }, { status });
   }
}
