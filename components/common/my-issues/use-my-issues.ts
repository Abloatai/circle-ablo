'use client';

import type { HydratedIssue } from '@/lib/data/hydrate';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

export const MY_ISSUES_TABS = ['assigned', 'created', 'subscribed', 'activity'] as const;
export type MyIssuesTab = (typeof MY_ISSUES_TABS)[number];

export const MY_ISSUES_TAB_ITEMS: { label: string; value: MyIssuesTab }[] = [
   { label: 'Assigned', value: 'assigned' },
   { label: 'Created', value: 'created' },
   { label: 'Subscribed', value: 'subscribed' },
   { label: 'Activity', value: 'activity' },
];

/** Shared tab state (URL-backed) between the header and the page body. */
export function useMyIssuesTab() {
   return useQueryState('tab', parseAsStringLiteral(MY_ISSUES_TABS).withDefault('assigned'));
}

/**
 * Issues shown by each My issues tab.
 *
 * Membership is now a fact on the row — who it is assigned to, who opened it —
 * rather than the hash of an identifier the fixtures used to stand in for one.
 */
export function scopeMyIssues(
   issues: HydratedIssue[],
   tab: MyIssuesTab,
   viewerId: string
): HydratedIssue[] {
   const isMine = (issue: HydratedIssue) =>
      issue.assignee?.id === viewerId || issue.createdBy === viewerId;

   switch (tab) {
      case 'assigned':
         return issues.filter((issue) => issue.assignee?.id === viewerId);
      case 'created':
         return issues.filter((issue) => issue.createdBy === viewerId);
      case 'subscribed':
         return issues.filter(isMine);
      case 'activity':
      default:
         // "Activity" = everything I touch, most recent first.
         return issues
            .filter(isMine)
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
   }
}
