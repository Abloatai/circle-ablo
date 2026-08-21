import { expect, test } from '@playwright/test';
import {
   GITHUB_MERGE_REQUEST_KIND,
   parseGitHubMergeRequestPayload,
} from '@/lib/github/merge-request';
import {
   signGitHubMergeApproval,
   verifyGitHubMergeApproval,
} from '@/lib/github/merge-approval-signature';

const valid = {
   kind: GITHUB_MERGE_REQUEST_KIND,
   text: 'requested approval',
   runId: 'run-1',
   url: 'https://github.com/acme/private-repo/pull/7',
   repository: 'acme/private-repo',
   pullNumber: 7,
   title: 'Ship it',
   headSha: '0123456789abcdef0123456789abcdef01234567',
   mergeMethod: 'squash',
   status: 'pending',
   requestedAt: '2026-08-21T12:00:00.000Z',
   approvalSignature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
} as const;

test('accepts a SHA-pinned GitHub merge approval payload', () => {
   expect(parseGitHubMergeRequestPayload(valid)).toEqual(valid);
});

test('rejects activity payloads that cannot safely authorize a merge', () => {
   expect(parseGitHubMergeRequestPayload({ ...valid, headSha: '0123456' })).toBeNull();
   expect(parseGitHubMergeRequestPayload({ ...valid, mergeMethod: 'force' })).toBeNull();
   expect(parseGitHubMergeRequestPayload({ ...valid, pullNumber: 7.5 })).toBeNull();
   expect(parseGitHubMergeRequestPayload({ ...valid, status: 'approved' })).toBeNull();
   expect(
      parseGitHubMergeRequestPayload({ ...valid, url: 'https://github.com/acme/other/pull/7' })
   ).toBeNull();
   expect(
      parseGitHubMergeRequestPayload({
         ...valid,
         url: 'https://github.com/acme/private-repo/pull/8',
      })
   ).toBeNull();
});

test('accepts the audit fields added after a successful merge', () => {
   const merged = {
      ...valid,
      status: 'merged',
      approvedById: 'user-1',
      approvedByName: 'Alice',
      mergedAt: '2026-08-21T12:05:00.000Z',
      mergedSha: '89abcdef0123456789abcdef0123456789abcdef',
   } as const;
   expect(parseGitHubMergeRequestPayload(merged)).toEqual(merged);
});

test('accepts only approval fields signed by Scout', () => {
   const secret = 'unit-test-secret';
   const approvalSignature = signGitHubMergeApproval(valid, secret);
   const signed = { ...valid, approvalSignature };
   expect(verifyGitHubMergeApproval(signed, secret)).toBe(true);
   expect(verifyGitHubMergeApproval({ ...signed, headSha: 'f'.repeat(40) }, secret)).toBe(false);
});
