import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { storedBlocksToMarkdown } from '../../lib/data/content-blocks';
import { listAll, listAllWhere, listRunComments, loadRun } from '../lib/circle';

export default defineTool({
   description:
      'Read the issue this run was given: title, description, status, and the discussion so far. Call this first.',
   inputSchema: z.object({
      runId: z.string().describe('The run id from the assignment message.'),
   }),
   async execute({ runId }) {
      const context = await loadRun(runId);
      if (!context.issueId) return { error: 'This run has no issue attached.' };

      const issue = await context.ablo.issue.get({ id: context.issueId });
      if (!issue) return { error: 'The issue is no longer readable.' };

      // Narrowed in `listAllWhere` rather than by the server, which matches
      // nothing on a `where` over a reference field — see the note there.
      const [comments, pullRequests] = await Promise.all([
         listRunComments(context),
         listAllWhere(
            (page) => context.ablo.issuePullRequest.list(page),
            (pullRequest) => pullRequest.issueId === context.issueId
         ),
      ]);

      const states = await listAll((page) => context.ablo.workflowState.list(page));
      const status = states.find((state) => state.id === issue.statusId);
      const discussion = comments.map((comment) => ({
         role:
            comment.authorId === context.agentUserId ? ('scout' as const) : ('teammate' as const),
         body: storedBlocksToMarkdown(comment.body),
         createdAt: comment.createdAt.toISOString(),
      }));
      const latestTeammateComment = discussion.findLast((comment) => comment.role === 'teammate');

      return {
         identifier: issue.identifier,
         title: issue.title,
         description: storedBlocksToMarkdown(issue.description),
         status: status?.name ?? issue.statusId,
         availableStatuses: states.map((state) => state.name),
         originalRequest: context.prompt,
         activeRequest: latestTeammateComment?.body ?? context.prompt,
         activeRequestSource: latestTeammateComment
            ? 'latest teammate comment'
            : 'original issue assignment',
         attachedPullRequests: pullRequests.map((pullRequest) => ({
            url: pullRequest.url,
            title: pullRequest.title,
            state: pullRequest.state,
         })),
         discussion,
      };
   },
});
