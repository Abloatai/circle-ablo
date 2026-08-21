import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { verifyGitHubWebhookSignature } from '@/lib/github/webhook-signature';

test('accepts only the matching GitHub webhook HMAC', () => {
   const body = JSON.stringify({ action: 'opened' });
   const secret = 'test-webhook-secret';
   const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

   expect(verifyGitHubWebhookSignature(body, signature, secret)).toBe(true);
   expect(verifyGitHubWebhookSignature(`${body} `, signature, secret)).toBe(false);
   expect(verifyGitHubWebhookSignature(body, 'sha256=wrong', secret)).toBe(false);
   expect(verifyGitHubWebhookSignature(body, null, secret)).toBe(false);
});
