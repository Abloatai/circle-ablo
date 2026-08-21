import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { inspectPullRequest } from '../../lib/github/app';
import { signGitHubMergeApproval } from '../../lib/github/merge-approval-signature';
import {
   GITHUB_MERGE_REQUEST_KIND,
   type GitHubMergeMethod,
   type GitHubMergeRequestPayload,
} from '../../lib/github/merge-request';
import {
   mentionsGitHubPullRequest,
   parseGitHubPullRequestUrl,
} from '../../lib/github/pull-request-url';
import { idempotencyKey, listAllWhere, loadRun } from '../lib/circle';

export default defineTool({
   description:
      'Request human approval to merge an open GitHub pull request attached or mentioned in the assigned issue. This never merges immediately: a workspace admin must review the pinned commit and approve it in Circle.',
   inputSchema: z.object({
      runId: z.string().describe('The run id from the assignment message.'),
      url: z.string().url().describe('The exact GitHub pull request URL.'),
      mergeMethod: z
         .enum(['merge', 'squash', 'rebase'])
         .default('squash')
         .describe('The merge method to ask the human to approve.'),
   }),
   async execute({ runId, url, mergeMethod }) {
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
         const pull = await inspectPullRequest({
            organizationId: context.organizationId,
            teamId: context.teamId,
            url,
         });
         if (pull.state !== 'open') {
            return { error: `The pull request is ${pull.state} and cannot be merged.` };
         }

         const method = mergeMethod as GitHubMergeMethod;
         const requestedAt = new Date().toISOString();
         const unsignedPayload: Omit<GitHubMergeRequestPayload, 'approvalSignature'> = {
            kind: GITHUB_MERGE_REQUEST_KIND,
            text: `requested approval to ${method} ${pull.repository}#${pull.number} at ${pull.headSha.slice(0, 7)}`,
            runId,
            url: pull.url,
            repository: pull.repository,
            pullNumber: pull.number,
            title: pull.title,
            headSha: pull.headSha,
            mergeMethod: method,
            status: 'pending',
            requestedAt,
         };
         const payload: GitHubMergeRequestPayload = {
            ...unsignedPayload,
            approvalSignature: signGitHubMergeApproval(unsignedPayload),
         };

         await context.ablo.issueActivity.create({
            idempotencyKey: idempotencyKey(
               runId,
               'github-merge-request',
               `${pull.url}:${pull.headSha}:${method}`
            ),
            data: {
               id: crypto.randomUUID(),
               workspaceId: context.organizationId,
               teamId: context.teamId,
               issueId: context.issueId,
               actorId: context.agentUserId,
               type: GITHUB_MERGE_REQUEST_KIND,
               payload,
            },
         });

         return {
            approvalRequired: true,
            repository: pull.repository,
            number: pull.number,
            title: pull.title,
            headSha: pull.headSha,
            mergeMethod: method,
         };
      } catch (error) {
         return {
            error: error instanceof Error ? error.message : 'Could not request the merge.',
         };
      }
   },
});
