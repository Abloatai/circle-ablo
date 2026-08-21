import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { listAll, listAllWhere, loadRun } from '../lib/circle';

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
      const comments = await listAllWhere(
         (page) => context.ablo.comment.list(page),
         (comment) => comment.issueId === context.issueId
      );
      const pullRequests = await listAllWhere(
         (page) => context.ablo.issuePullRequest.list(page),
         (pullRequest) => pullRequest.issueId === context.issueId
      );

      const states = await listAll((page) => context.ablo.workflowState.list(page));
      const status = states.find((state) => state.id === issue.statusId);

      return {
         identifier: issue.identifier,
         title: issue.title,
         description: issue.description,
         status: status?.name ?? issue.statusId,
         availableStatuses: states.map((state) => state.name),
         request: context.prompt,
         attachedPullRequests: pullRequests.map((pullRequest) => ({
            url: pullRequest.url,
            title: pullRequest.title,
            state: pullRequest.state,
         })),
         discussion: comments.map((comment) => ({
            author: comment.authorId,
            body: comment.body,
         })),
      };
   },
});
