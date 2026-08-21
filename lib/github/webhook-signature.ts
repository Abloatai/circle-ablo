import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGitHubWebhookSignature(
   body: string,
   supplied: string | null,
   secret: string
): boolean {
   if (!supplied?.startsWith('sha256=')) return false;
   const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
   const left = Buffer.from(supplied);
   const right = Buffer.from(expected);
   return left.length === right.length && timingSafeEqual(left, right);
}
