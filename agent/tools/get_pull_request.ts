import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { inspectPullRequest } from '../../lib/github/app';
import {
   mentionsGitHubPullRequest,
   parseGitHubPullRequestUrl,
} from '../../lib/github/pull-request-url';
import { listAllWhere, loadRun } from '../lib/circle';
import { loadAuthorizedReviewContext } from '../lib/review-context';

export default defineTool({
   description:
      'Inspect the title, description, commits, changed files, and diff of a GitHub pull request linked or mentioned in the assigned issue. Supports private repositories connected to the issue team.',
   inputSchema: z.object({
      runId: z
         .string()
         .optional()
         .describe(
            'The Circle run id returned by get_assignment. Delegated subagents may omit it because their authorized parent session identifies the run.'
         ),
      url: z.string().url().describe('The GitHub pull request URL from the assigned issue.'),
   }),
   async execute({ runId, url }, toolContext) {
      try {
         // A child session carries tamper-resistant lineage to its root session.
         // Prefer it over model-authored input so a missed or invented runId cannot
         // break the review or widen it to another issue.
         const rootSessionId = toolContext.session.parent?.rootSessionId;
         const reviewContext = rootSessionId
            ? await loadAuthorizedReviewContext(runId, toolContext)
            : undefined;
         const context = reviewContext
            ? reviewContext.run
            : runId
              ? await loadRun(runId)
              : undefined;
         if (!context) return { error: 'This tool needs the run id returned by get_assignment.' };
         if (!context.issueId) return { error: 'This run has no issue attached.' };

         const coordinates = parseGitHubPullRequestUrl(url);
         if (!coordinates) return { error: 'The URL is not a GitHub pull request.' };
         if (
            reviewContext &&
            !mentionsGitHubPullRequest(reviewContext.mission.pullRequestUrl, coordinates)
         ) {
            return { error: 'That pull request is outside this review mission.' };
         }

         const issue = await context.ablo.issue.get({ id: context.issueId });
         if (!issue) return { error: 'The issue is no longer readable.' };
         const [comments, pullRequests] = await Promise.all([
            listAllWhere(
               (page) => context.ablo.comment.list(page),
               (comment) => comment.issueId === context.issueId
            ),
            listAllWhere(
               (page) => context.ablo.issuePullRequest.list(page),
               (pullRequest) => pullRequest.issueId === context.issueId
            ),
         ]);

         const authorized =
            mentionsGitHubPullRequest(issue.description, coordinates) ||
            comments.some((comment) => mentionsGitHubPullRequest(comment.body, coordinates)) ||
            pullRequests.some((pullRequest) =>
               mentionsGitHubPullRequest(pullRequest.url, coordinates)
            );
         if (!authorized) {
            return { error: 'That pull request is not linked or mentioned in the assigned issue.' };
         }

         const pull = await inspectPullRequest({
            organizationId: context.organizationId,
            teamId: context.teamId,
            url,
         });
         if (reviewContext && pull.headSha !== reviewContext.mission.headSha) {
            return {
               error: `The pull request moved after this review was pinned. Expected ${reviewContext.mission.headSha}, found ${pull.headSha}. Start a new review mission for the new revision.`,
            };
         }
         return pull;
      } catch (error) {
         return {
            error: error instanceof Error ? error.message : 'Could not inspect the pull request.',
         };
      }
   },
});
