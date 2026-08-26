import type { ToolContext } from 'eve/tools';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { reviewMission } from '../../db/schema/app';
import { loadRun, loadRunBySessionId, type RunContext } from './circle';

export interface AuthorizedReviewContext {
   run: RunContext;
   mission: {
      id: string;
      pullRequestUrl: string;
      headSha: string;
   };
}

/**
 * Resolves the exact review mission from Eve's trusted parent lineage. A root
 * tool call may use get_assignment's run id; a delegated child never gets to
 * widen its scope by supplying another one.
 */
export async function loadAuthorizedReviewContext(
   runId: string | undefined,
   toolContext: ToolContext
): Promise<AuthorizedReviewContext> {
   const rootSessionId = toolContext.session.parent?.rootSessionId;
   const run = rootSessionId
      ? await loadRunBySessionId(rootSessionId)
      : runId
        ? await loadRun(runId)
        : undefined;
   if (!run) throw new Error('This tool needs the run id returned by get_assignment');
   if (!run.issueId) throw new Error('This run has no issue attached');

   const [mission] = await db
      .select({
         id: reviewMission.id,
         pullRequestUrl: reviewMission.pullRequestUrl,
         headSha: reviewMission.headSha,
      })
      .from(reviewMission)
      .where(
         and(
            eq(reviewMission.agentRunId, run.runId),
            eq(reviewMission.organizationId, run.organizationId),
            eq(reviewMission.teamId, run.teamId),
            eq(reviewMission.issueId, run.issueId)
         )
      )
      .orderBy(desc(reviewMission.createdAt))
      .limit(1);
   if (!mission) throw new Error('This run is not attached to a review mission');
   return { run, mission };
}
