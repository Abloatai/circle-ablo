import { parseGitHubPullRequestUrl } from './pull-request-url';

export const GITHUB_MERGE_REQUEST_KIND = 'github_merge_request' as const;

export type GitHubMergeMethod = 'merge' | 'squash' | 'rebase';
export type GitHubMergeRequestStatus = 'pending' | 'merged' | 'failed';

export interface GitHubMergeRequestPayload {
   kind: typeof GITHUB_MERGE_REQUEST_KIND;
   text: string;
   runId: string;
   url: string;
   repository: string;
   pullNumber: number;
   title: string;
   headSha: string;
   mergeMethod: GitHubMergeMethod;
   status: GitHubMergeRequestStatus;
   requestedAt: string;
   approvalSignature: string;
   approvedById?: string;
   approvedByName?: string;
   mergedAt?: string;
   mergedSha?: string;
   error?: string;
}

const isMergeMethod = (value: unknown): value is GitHubMergeMethod =>
   value === 'merge' || value === 'squash' || value === 'rebase';

const isStatus = (value: unknown): value is GitHubMergeRequestStatus =>
   value === 'pending' || value === 'merged' || value === 'failed';

/** Validate untyped JSON before using it to render or authorize a merge. */
export function parseGitHubMergeRequestPayload(value: unknown): GitHubMergeRequestPayload | null {
   if (!value || typeof value !== 'object') return null;
   const payload = value as Record<string, unknown>;
   if (
      payload.kind !== GITHUB_MERGE_REQUEST_KIND ||
      typeof payload.text !== 'string' ||
      typeof payload.runId !== 'string' ||
      typeof payload.url !== 'string' ||
      typeof payload.repository !== 'string' ||
      typeof payload.pullNumber !== 'number' ||
      !Number.isSafeInteger(payload.pullNumber) ||
      typeof payload.title !== 'string' ||
      typeof payload.headSha !== 'string' ||
      !/^[0-9a-f]{40}$/i.test(payload.headSha) ||
      !isMergeMethod(payload.mergeMethod) ||
      !isStatus(payload.status) ||
      typeof payload.requestedAt !== 'string' ||
      typeof payload.approvalSignature !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(payload.approvalSignature)
   ) {
      return null;
   }

   const coordinates = parseGitHubPullRequestUrl(payload.url);
   if (
      !coordinates ||
      `${coordinates.owner}/${coordinates.repository}`.toLowerCase() !==
         payload.repository.toLowerCase() ||
      coordinates.number !== payload.pullNumber
   ) {
      return null;
   }

   const optionalStrings = [
      'approvedById',
      'approvedByName',
      'mergedAt',
      'mergedSha',
      'error',
   ] as const;
   if (
      optionalStrings.some((key) => payload[key] !== undefined && typeof payload[key] !== 'string')
   ) {
      return null;
   }

   return payload as unknown as GitHubMergeRequestPayload;
}
