import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { searchRepositoryCodeAtRevision } from '../../lib/github/app';
import { loadAuthorizedReviewContext } from '../lib/review-context';

export default defineTool({
   description:
      'Search a bounded page of repository source at the review mission’s exact pinned commit. Results include file paths and line numbers. Follow nextCursor when material context may remain.',
   inputSchema: z.object({
      runId: z.string().optional().describe('The Circle run id returned by get_assignment.'),
      query: z.string().min(2).max(200).describe('Literal source text or symbol to find.'),
      pathPrefix: z.string().optional().describe('Optional repository directory to search within.'),
      cursor: z
         .number()
         .int()
         .min(0)
         .optional()
         .describe('Continuation cursor from a prior search.'),
      caseSensitive: z.boolean().optional(),
   }),
   async execute({ runId, query, pathPrefix, cursor, caseSensitive }, toolContext) {
      try {
         const { run, mission } = await loadAuthorizedReviewContext(runId, toolContext);
         return await searchRepositoryCodeAtRevision({
            organizationId: run.organizationId,
            teamId: run.teamId,
            url: mission.pullRequestUrl,
            headSha: mission.headSha,
            query,
            pathPrefix,
            cursor,
            caseSensitive,
         });
      } catch (error) {
         return { error: error instanceof Error ? error.message : 'Could not search repository.' };
      }
   },
});
