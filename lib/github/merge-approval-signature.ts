import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GitHubMergeRequestPayload } from './merge-request';

type SignedFields = Pick<
   GitHubMergeRequestPayload,
   | 'runId'
   | 'url'
   | 'repository'
   | 'pullNumber'
   | 'title'
   | 'headSha'
   | 'mergeMethod'
   | 'requestedAt'
>;

const signatureBody = (payload: SignedFields): string =>
   JSON.stringify([
      payload.runId,
      payload.url,
      payload.repository,
      payload.pullNumber,
      payload.title,
      payload.headSha,
      payload.mergeMethod,
      payload.requestedAt,
   ]);

const configuredSecret = (): string => {
   const secret = process.env.AGENT_CHANNEL_SECRET;
   if (!secret) throw new Error('AGENT_CHANNEL_SECRET is required for merge approvals');
   return secret;
};

/** Proves an approval row came from Circle's authenticated Scout deployment. */
export function signGitHubMergeApproval(
   payload: SignedFields,
   secret = configuredSecret()
): string {
   return createHmac('sha256', secret).update(signatureBody(payload)).digest('base64url');
}

export function verifyGitHubMergeApproval(
   payload: SignedFields & { approvalSignature: string },
   secret = configuredSecret()
): boolean {
   const expected = Buffer.from(signGitHubMergeApproval(payload, secret));
   const supplied = Buffer.from(payload.approvalSignature);
   return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
