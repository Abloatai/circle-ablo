import { expect, test } from '@playwright/test';
import { storedBlocksToMarkdown } from '@/lib/data/content-blocks';

test('turns persisted comment blocks into the text shown to an agent', () => {
   expect(
      storedBlocksToMarkdown(
         JSON.stringify([
            { type: 'paragraph', text: 'Merge the PR.' },
            { type: 'bullet-list', items: ['Use squash', 'Keep the branch'] },
         ])
      )
   ).toBe('Merge the PR.\n\n- Use squash\n- Keep the branch');
});

test('keeps legacy plain-text content unchanged', () => {
   expect(storedBlocksToMarkdown('merge it')).toBe('merge it');
});
