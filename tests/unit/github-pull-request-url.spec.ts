import { expect, test } from '@playwright/test';
import {
   mentionsGitHubPullRequest,
   parseGitHubPullRequestUrl,
} from '@/lib/github/pull-request-url';

test('parses canonical GitHub pull request URLs', () => {
   expect(parseGitHubPullRequestUrl('https://github.com/Eagardh/publication/pull/2')).toEqual({
      owner: 'Eagardh',
      repository: 'publication',
      number: 2,
   });
   expect(parseGitHubPullRequestUrl('https://www.github.com/acme/repo/pull/42/')).toEqual({
      owner: 'acme',
      repository: 'repo',
      number: 42,
   });
});

test('rejects lookalike hosts and non-pull-request paths', () => {
   expect(parseGitHubPullRequestUrl('https://github.example.com/acme/repo/pull/2')).toBeNull();
   expect(parseGitHubPullRequestUrl('https://github.com/acme/repo/issues/2')).toBeNull();
   expect(parseGitHubPullRequestUrl('https://github.com/acme/repo/pull/2/files')).toBeNull();
   expect(parseGitHubPullRequestUrl('not a url')).toBeNull();
});

test('finds only the requested pull request in issue text', () => {
   const target = { owner: 'Acme', repository: 'private-repo', number: 7 };
   const richText = JSON.stringify({
      type: 'paragraph',
      text: 'Please inspect https://github.com/acme/private-repo/pull/7.',
   });

   expect(mentionsGitHubPullRequest(richText, target)).toBe(true);
   expect(mentionsGitHubPullRequest('https://github.com/acme/private-repo/pull/8', target)).toBe(
      false
   );
   expect(
      mentionsGitHubPullRequest('https://github.example.com/acme/private-repo/pull/7', target)
   ).toBe(false);
});
