import { expect, test } from '@playwright/test';
import { createReviewId, parseGitHubPatch, parseReviewId } from '@/lib/domain/reviews';
import { normalizedConfidence, reviewFindingFingerprint } from '@/lib/domain/review-team';

test('round-trips a repository record and pull number through a review URL id', () => {
   const id = createReviewId('github_repository_123_456', 27);
   expect(id).toBe('github_repository_123_456~27');
   expect(parseReviewId(id)).toEqual({
      repositoryId: 'github_repository_123_456',
      pullNumber: 27,
   });
   expect(parseReviewId('github_repository_123_456~0')).toBeNull();
   expect(parseReviewId('../../secret~2')).toBeNull();
});

test('parses additions, deletions, context and gaps from a GitHub patch', () => {
   const diff = parseGitHubPatch({
      filename: 'src/lib/example.ts',
      additions: 2,
      deletions: 1,
      patch: [
         '@@ -2,3 +2,3 @@',
         ' const before = true;',
         '-const oldName = 1;',
         '+const newName = 1;',
         ' export default before;',
         '@@ -20,1 +20,2 @@',
         ' context();',
         '+added();',
      ].join('\n'),
   });

   expect(diff.name).toBe('example.ts');
   expect(diff.path).toBe('src/lib');
   expect(diff.patchAvailable).toBe(true);
   expect(diff.lines).toEqual([
      { type: 'context', number: 2, text: 'const before = true;' },
      { type: 'del', text: 'const oldName = 1;' },
      { type: 'add', number: 3, text: 'const newName = 1;' },
      { type: 'context', number: 4, text: 'export default before;' },
      { type: 'skip', count: 15 },
      { type: 'context', number: 20, text: 'context();' },
      { type: 'add', number: 21, text: 'added();' },
   ]);
});

test('marks binary or oversized files when GitHub omits their patch', () => {
   expect(
      parseGitHubPatch({ filename: 'assets/logo.png', additions: 0, deletions: 0 })
   ).toMatchObject({ name: 'logo.png', path: 'assets', lines: [], patchAvailable: false });
});

test('builds stable finding fingerprints from the evidence location', () => {
   const finding = {
      category: 'correctness',
      title: 'Returns the stale record',
      path: 'src/query.ts',
      line: 42,
   };
   expect(reviewFindingFingerprint(finding)).toBe(reviewFindingFingerprint(finding));
   expect(reviewFindingFingerprint(finding)).not.toBe(
      reviewFindingFingerprint({ ...finding, line: 43 })
   );
});

test('bounds model confidence before it reaches the live finding model', () => {
   expect(normalizedConfidence(-0.2)).toBe(0);
   expect(normalizedConfidence(0.73)).toBe(0.73);
   expect(normalizedConfidence(4)).toBe(1);
});
