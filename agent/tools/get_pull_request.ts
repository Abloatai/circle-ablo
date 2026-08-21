import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { inspectPullRequest } from '../../lib/github/app';
import {
   mentionsGitHubPullRequest,
   parseGitHubPullRequestUrl,
} from '../../lib/github/pull-request-url';
import { listAllWhere, loadRun } from '../lib/circle';

export default defineTool({
   description:
      'Inspect the title, description, commits, changed files, and diff of a GitHub pull request linked or mentioned in the assigned issue. Supports private repositories connected to the issue team.',
   inputSchema: z.object({
      runId: z.string().describe('The run id from the assignment message.'),
      url: z.string().url().describe('The GitHub pull request URL from the assigned issue.'),
   }),
   async execute({ runId, url }) {
      const context = await loadRun(runId);
      if (!context.issueId) return { error: 'This run has no issue attached.' };

      const coordinates = parseGitHubPullRequestUrl(url);
      if (!coordinates) return { error: 'The URL is not a GitHub pull request.' };

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

      try {
         return await inspectPullRequest({
            organizationId: context.organizationId,
            teamId: context.teamId,
            url,
         });
      } catch (error) {
         return {
            error: error instanceof Error ? error.message : 'Could not inspect the pull request.',
         };
      }
   },
});
