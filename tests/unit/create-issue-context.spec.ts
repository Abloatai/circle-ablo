import { expect, test } from '@playwright/test';
import { useCreateIssueStore } from '@/store/create-issue-store';

test('opening issue creation from a cycle preserves and clears the cycle context', () => {
   useCreateIssueStore.getState().openModal(undefined, undefined, 'cycle-42');
   expect(useCreateIssueStore.getState().defaultCycleId).toBe('cycle-42');

   useCreateIssueStore.getState().closeModal();
   expect(useCreateIssueStore.getState().defaultCycleId).toBeNull();
});
