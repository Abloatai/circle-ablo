import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { readRepositoryFileAtRevision } from '../../lib/github/app';
import { loadAuthorizedReviewContext } from '../lib/review-context';

export default defineTool({
   description:
      'Read a bounded, line-numbered excerpt from one repository file at the review mission’s exact pinned commit. This is read-only and cannot access another repository or revision.',
   inputSchema: z.object({
      runId: z.string().optional().describe('The Circle run id returned by get_assignment.'),
      path: z.string().min(1).describe('Repository-relative file path.'),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional(),
   }),
   async execute({ runId, path, startLine, endLine }, toolContext) {
      try {
         const { run, mission } = await loadAuthorizedReviewContext(runId, toolContext);
         return await readRepositoryFileAtRevision({
            organizationId: run.organizationId,
            teamId: run.teamId,
            url: mission.pullRequestUrl,
            headSha: mission.headSha,
            path,
            startLine,
            endLine,
         });
      } catch (error) {
         return {
            error: error instanceof Error ? error.message : 'Could not read repository file.',
         };
      }
   },
});
