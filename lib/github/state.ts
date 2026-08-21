import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

interface GitHubSetupState {
   organizationId: string;
   userId: string;
   expiresAt: number;
}

const secret = () => {
   const value = process.env.BETTER_AUTH_SECRET;
   if (!value) throw new Error('BETTER_AUTH_SECRET is required to sign GitHub setup state');
   return value;
};

export function createGitHubSetupState(organizationId: string, userId: string): string {
   const payload = Buffer.from(
      JSON.stringify({ organizationId, userId, expiresAt: Date.now() + 10 * 60_000 })
   ).toString('base64url');
   const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
   return `${payload}.${signature}`;
}

export function verifyGitHubSetupState(value: string): GitHubSetupState | null {
   const [payload, suppliedSignature] = value.split('.');
   if (!payload || !suppliedSignature) return null;
   const expectedSignature = createHmac('sha256', secret()).update(payload).digest('base64url');
   const supplied = Buffer.from(suppliedSignature);
   const expected = Buffer.from(expectedSignature);
   if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

   try {
      const decoded = JSON.parse(
         Buffer.from(payload, 'base64url').toString('utf8')
      ) as GitHubSetupState;
      if (!decoded.organizationId || !decoded.userId || decoded.expiresAt < Date.now()) return null;
      return decoded;
   } catch {
      return null;
   }
}
