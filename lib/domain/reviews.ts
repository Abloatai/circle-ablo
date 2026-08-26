/** Serializable GitHub pull-request data rendered by Circle's Reviews section. */

export type ReviewStatus = 'open' | 'draft' | 'merged' | 'closed';
export type ReviewList = 'open' | 'completed';
export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

export interface ReviewSummary {
   id: string;
   title: string;
   status: ReviewStatus;
   repository: string;
   prNumber: number;
   url: string;
   author: string;
   targetBranch: string;
   sourceBranch: string;
   updatedAt: string;
   updatedLabel: string;
}

export interface ReviewCommit {
   sha: string;
   message: string;
   author: string | null;
}

export interface DiffLine {
   type: 'context' | 'add' | 'del' | 'skip';
   /** New-file line number (omitted for deleted and collapsed lines). */
   number?: number;
   text?: string;
   /** Number of unchanged lines between unified diff hunks. */
   count?: number;
}

export interface FileDiff {
   name: string;
   path: string;
   additions: number;
   deletions: number;
   lines: DiffLine[];
   patchAvailable: boolean;
}

export interface ReviewFile {
   filename: string;
   name: string;
   path: string;
   status: string;
   additions: number;
   deletions: number;
   category: 'implementation' | 'tests';
   diff: FileDiff;
}

export interface SubmittedReview {
   id: number;
   author: string;
   state: string;
   body: string;
   submittedAt: string | null;
   submittedLabel: string | null;
}

export interface Review extends ReviewSummary {
   body: string;
   headSha: string;
   additions: number;
   deletions: number;
   changedFiles: number;
   commits: ReviewCommit[];
   files: ReviewFile[];
   submittedReviews: SubmittedReview[];
   linkedIssue?: { id: string; identifier: string; title: string };
   truncated: boolean;
}

export interface ReviewCollection {
   reviews: ReviewSummary[];
   connectedRepositories: number;
   failedRepositories: number;
}

export function createReviewId(repositoryId: string, pullNumber: number): string {
   return `${repositoryId}~${pullNumber}`;
}

export function parseReviewId(value: string): { repositoryId: string; pullNumber: number } | null {
   const match = /^(github_repository_[A-Za-z0-9_-]+)~([1-9]\d*)$/.exec(value);
   if (!match) return null;
   const pullNumber = Number(match[2]);
   return Number.isSafeInteger(pullNumber) ? { repositoryId: match[1], pullNumber } : null;
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/** Converts GitHub's bounded unified patch into lightweight diff rows. */
export function parseGitHubPatch(input: {
   filename: string;
   additions: number;
   deletions: number;
   patch?: string;
}): FileDiff {
   const slash = input.filename.lastIndexOf('/');
   const name = slash >= 0 ? input.filename.slice(slash + 1) : input.filename;
   const path = slash >= 0 ? input.filename.slice(0, slash) : '';
   if (!input.patch) {
      return {
         name,
         path,
         additions: input.additions,
         deletions: input.deletions,
         lines: [],
         patchAvailable: false,
      };
   }

   const lines: DiffLine[] = [];
   let nextNewLine = 0;
   let previousHunkEnd = 0;

   for (const raw of input.patch.split('\n')) {
      const hunk = HUNK_HEADER.exec(raw);
      if (hunk) {
         const start = Number(hunk[1]);
         const skipped = previousHunkEnd > 0 ? Math.max(0, start - previousHunkEnd) : 0;
         if (skipped > 0) lines.push({ type: 'skip', count: skipped });
         nextNewLine = start;
         continue;
      }
      if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('diff ')) continue;
      if (raw.startsWith('\\ No newline at end of file')) continue;

      if (raw.startsWith('+')) {
         lines.push({ type: 'add', number: nextNewLine, text: raw.slice(1) });
         nextNewLine += 1;
      } else if (raw.startsWith('-')) {
         lines.push({ type: 'del', text: raw.slice(1) });
      } else {
         lines.push({ type: 'context', number: nextNewLine, text: raw.slice(1) });
         nextNewLine += 1;
      }
      previousHunkEnd = nextNewLine;
   }

   return {
      name,
      path,
      additions: input.additions,
      deletions: input.deletions,
      lines,
      patchAvailable: true,
   };
}
