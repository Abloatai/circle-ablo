import { expect, test } from '@playwright/test';
import { scopeMyIssues } from '@/components/common/my-issues/use-my-issues';
import type { HydratedIssue } from '@/lib/data/hydrate';

const issue = (over: Partial<HydratedIssue> & { id: string }) =>
   ({
      identifier: `X-${over.id}`,
      title: `Issue ${over.id}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      labels: [],
      ...over,
   }) as unknown as HydratedIssue;

const ME = 'me';
const issues = [
   issue({ id: '1', assignee: { id: ME } as HydratedIssue['assignee'], createdBy: 'other' }),
   issue({ id: '2', createdBy: ME }),
   issue({ id: '3', createdBy: 'other' }),
   issue({ id: '4', createdBy: 'other' }),
];

test('Assigned is what is assigned to me', () => {
   expect(scopeMyIssues(issues, 'assigned', ME).map((i) => i.id)).toEqual(['1']);
});

test('Created is what I opened', () => {
   expect(scopeMyIssues(issues, 'created', ME).map((i) => i.id)).toEqual(['2']);
});

test('Subscribed is what I subscribed to, not what I am involved in', () => {
   // The regression this guards: Subscribed used to fall back to "issues I am
   // involved in", which made it a duplicate of Activity and meant subscribing
   // to an issue you had no connection to showed you nothing.
   expect(scopeMyIssues(issues, 'subscribed', ME, new Set(['3', '4'])).map((i) => i.id)).toEqual([
      '3',
      '4',
   ]);
   expect(scopeMyIssues(issues, 'subscribed', ME, new Set()).map((i) => i.id)).toEqual([]);
});

test('Subscribed defaults to empty rather than to everything', () => {
   expect(scopeMyIssues(issues, 'subscribed', ME).map((i) => i.id)).toEqual([]);
});
