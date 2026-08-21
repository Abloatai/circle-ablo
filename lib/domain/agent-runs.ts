export interface IssueRunResumeCandidate {
   sessionId: string | null;
   status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'canceled';
}

/**
 * A finished piece of work can still have a live Eve conversation behind it.
 * Scout records `succeeded` before parking its session, so a later issue
 * comment is a valid follow-up for every state except an explicitly broken or
 * canceled run.
 */
export function canResumeIssueRun(
   run: IssueRunResumeCandidate
): run is IssueRunResumeCandidate & { sessionId: string } {
   return Boolean(run.sessionId) && run.status !== 'failed' && run.status !== 'canceled';
}
