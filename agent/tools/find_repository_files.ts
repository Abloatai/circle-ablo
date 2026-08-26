import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { listRepositoryFilesAtRevision } from '../../lib/github/app';
import { loadAuthorizedReviewContext } from '../lib/review-context';

export default defineTool({
   description:
      'Find repository file paths at the review mission’s exact pinned commit. Use this to locate relevant callers, tests, configuration, or dependencies before reading them.',
   inputSchema: z.object({
      runId: z.string().optional().describe('The Circle run id returned by get_assignment.'),
      pathPrefix: z.string().optional().describe('Optional repository directory to search within.'),
      query: z
         .string()
         .optional()
         .describe('Optional case-insensitive substring to match in paths.'),
      limit: z.number().int().min(1).max(500).optional(),
   }),
   async execute({ runId, pathPrefix, query, limit }, toolContext) {
      try {
         const { run, mission } = await loadAuthorizedReviewContext(runId, toolContext);
         return await listRepositoryFilesAtRevision({
            organizationId: run.organizationId,
            teamId: run.teamId,
            url: mission.pullRequestUrl,
            headSha: mission.headSha,
            pathPrefix,
            query,
            limit,
         });
      } catch (error) {
         return {
            error: error instanceof Error ? error.message : 'Could not list repository files.',
         };
      }
   },
});
