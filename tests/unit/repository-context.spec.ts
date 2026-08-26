import { expect, test } from '@playwright/test';
import {
   isSearchableRepositoryPath,
   literalLineMatches,
   normalizeRepositoryPath,
   numberedExcerpt,
} from '@/lib/github/repository-context';

test('accepts only unambiguous repository-relative paths', () => {
   expect(normalizeRepositoryPath('/src\\review.ts/')).toBe('src/review.ts');
   expect(normalizeRepositoryPath('../secrets')).toBeNull();
   expect(normalizeRepositoryPath('src/../secrets')).toBeNull();
   expect(normalizeRepositoryPath('')).toBeNull();
});

test('recognizes source context while excluding generated and lock files', () => {
   expect(isSearchableRepositoryPath('src/review.tsx')).toBe(true);
   expect(isSearchableRepositoryPath('Dockerfile')).toBe(true);
   expect(isSearchableRepositoryPath('dist/app.min.js')).toBe(false);
   expect(isSearchableRepositoryPath('pnpm-lock.yaml')).toBe(false);
   expect(isSearchableRepositoryPath('assets/logo.png')).toBe(false);
});

test('bounds repository excerpts and preserves exact line numbers', () => {
   expect(numberedExcerpt('one\ntwo\nthree\nfour', 2, 3, 10)).toEqual({
      content: '2 | two\n3 | three',
      startLine: 2,
      endLine: 3,
      totalLines: 4,
      truncated: true,
   });
   expect(numberedExcerpt('one\ntwo\nthree', 1, 3, 2).endLine).toBe(2);
});

test('finds literal source matches with bounded line evidence', () => {
   expect(literalLineMatches('const Token = 1;\nconst token = 2;', 'token', false, 10)).toEqual([
      { line: 1, text: 'const Token = 1;' },
      { line: 2, text: 'const token = 2;' },
   ]);
   expect(literalLineMatches('Token\ntoken', 'Token', true, 1)).toEqual([
      { line: 1, text: 'Token' },
   ]);
});
