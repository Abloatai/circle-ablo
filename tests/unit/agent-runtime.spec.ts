import { expect, test } from '@playwright/test';
import { canResumeIssueRun } from '@/lib/domain/agent-runs';

test('issue comments can resume every live agent conversation state', () => {
   for (const status of ['queued', 'running', 'waiting', 'succeeded'] as const) {
      expect(canResumeIssueRun({ sessionId: 'eve-session', status })).toBe(true);
   }
});

test('issue comments do not revive missing, failed, or canceled sessions', () => {
   expect(canResumeIssueRun({ sessionId: null, status: 'waiting' })).toBe(false);
   expect(canResumeIssueRun({ sessionId: 'eve-session', status: 'failed' })).toBe(false);
   expect(canResumeIssueRun({ sessionId: 'eve-session', status: 'canceled' })).toBe(false);
});
