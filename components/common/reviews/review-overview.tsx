'use client';

import type { Review } from '@/lib/domain/reviews';
import { ChevronDown, FileCode2, GitCommitHorizontal } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DiffStat, IssueCheckIcon, PrIcon } from './review-shared';
import { ReviewSubmit } from './review-submit';
import { ReviewTeam } from './review-team';

const ReviewMarkdown = dynamic(() =>
   import('./review-markdown').then((module) => module.ReviewMarkdown)
);

const REVIEW_STATE_LABELS: Record<string, string> = {
   APPROVED: 'Approved',
   CHANGES_REQUESTED: 'Requested changes',
   COMMENTED: 'Commented',
   DISMISSED: 'Dismissed',
   PENDING: 'Pending',
};

function FilesPanel({ review }: { review: Review }) {
   const categories = (['implementation', 'tests'] as const)
      .map((category) => ({
         category,
         files: review.files.filter((file) => file.category === category),
      }))
      .filter((group) => group.files.length > 0);

   return (
      <div className="flex flex-col gap-2">
         <span className="text-sm font-medium">{review.files.length} files changed</span>
         {categories.map((group) => {
            const additions = group.files.reduce((sum, file) => sum + file.additions, 0);
            const deletions = group.files.reduce((sum, file) => sum + file.deletions, 0);
            return (
               <div key={group.category} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <span className="font-medium text-foreground capitalize">
                        {group.category}
                     </span>
                     {group.files.length}
                     <ChevronDown className="size-3" />
                     <span className="flex-1" />
                     <DiffStat additions={additions} deletions={deletions} />
                  </div>
                  {group.files.map((file) => (
                     <div key={file.filename} className="flex items-center gap-1.5 text-xs pl-2">
                        <FileCode2 className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{file.name}</span>
                        {file.path ? (
                           <span className="text-muted-foreground truncate">{file.path}</span>
                        ) : null}
                     </div>
                  ))}
               </div>
            );
         })}
      </div>
   );
}

export function ReviewOverview({ review, orgId }: { review: Review; orgId: string }) {
   const canReview = review.status === 'open' || review.status === 'draft';

   return (
      <div className="h-full flex overflow-hidden">
         <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-6">
               <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-semibold leading-snug">{review.title}</h1>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono flex-wrap">
                     <PrIcon status={review.status} className="size-3.5" />
                     <span>
                        {review.repository}#{review.prNumber}
                     </span>
                     <span>·</span>
                     <span>
                        {review.targetBranch} ← {review.sourceBranch}
                     </span>
                     <span>·</span>
                     <span>by {review.author}</span>
                  </div>
               </div>

               <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium">Description</h2>
                  {review.body ? (
                     <ReviewMarkdown>{review.body}</ReviewMarkdown>
                  ) : (
                     <p className="text-sm text-muted-foreground">No description provided.</p>
                  )}
               </section>

               {review.linkedIssue ? (
                  <section className="flex flex-col gap-2">
                     <h2 className="text-sm font-medium">Linked issue</h2>
                     <Link
                        href={`/${orgId}/issue/${review.linkedIssue.id}`}
                        className="inline-flex items-center gap-2 rounded-md bg-muted/60 border border-border/60 px-2 py-1.5 text-sm hover:bg-muted transition-colors self-start"
                     >
                        <IssueCheckIcon />
                        <span className="font-medium">{review.linkedIssue.identifier}</span>
                        <span className="text-muted-foreground truncate">
                           {review.linkedIssue.title}
                        </span>
                     </Link>
                  </section>
               ) : null}

               <ReviewTeam orgId={orgId} pullRequestUrl={review.url} headSha={review.headSha} />

               <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium">Commits</h2>
                  <div className="rounded-lg border divide-y">
                     {review.commits.map((commit) => (
                        <div key={commit.sha} className="flex items-center gap-2 px-3 py-2 text-xs">
                           <GitCommitHorizontal className="size-3.5 text-muted-foreground shrink-0" />
                           <span className="font-mono text-muted-foreground">
                              {commit.sha.slice(0, 7)}
                           </span>
                           <span className="flex-1 truncate">{commit.message.split('\n')[0]}</span>
                           <span className="text-muted-foreground shrink-0">
                              {commit.author ?? 'Unknown author'}
                           </span>
                        </div>
                     ))}
                  </div>
               </section>

               {review.submittedReviews.length > 0 ? (
                  <section className="flex flex-col gap-2">
                     <h2 className="text-sm font-medium">GitHub reviews</h2>
                     <div className="flex flex-col gap-2">
                        {review.submittedReviews.map((submitted) => (
                           <div key={submitted.id} className="rounded-lg border p-3 text-sm">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                 <span className="font-medium text-foreground">
                                    {submitted.author}
                                 </span>
                                 <span>
                                    {REVIEW_STATE_LABELS[submitted.state] ??
                                       submitted.state.toLowerCase()}
                                 </span>
                                 {submitted.submittedLabel ? (
                                    <span className="ml-auto">{submitted.submittedLabel}</span>
                                 ) : null}
                              </div>
                              {submitted.body ? (
                                 <div className="mt-2">
                                    <ReviewMarkdown>{submitted.body}</ReviewMarkdown>
                                 </div>
                              ) : null}
                           </div>
                        ))}
                     </div>
                  </section>
               ) : null}

               {canReview ? <ReviewSubmit orgId={orgId} reviewId={review.id} /> : null}
            </div>
         </div>

         <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l h-full overflow-y-auto p-5 gap-6">
            <div className="flex flex-col gap-2">
               <span className="text-sm font-medium">Status</span>
               <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                  <PrIcon status={review.status} />
                  {review.status}
               </span>
            </div>
            <div className="flex flex-col gap-2">
               <span className="text-sm font-medium">Author</span>
               <span className="text-sm text-muted-foreground">{review.author}</span>
            </div>
            <div className="flex flex-col gap-2">
               <span className="text-sm font-medium">Revision</span>
               <span className="text-xs font-mono text-muted-foreground">
                  {review.headSha.slice(0, 12)}
               </span>
            </div>
            <div className="flex flex-col gap-2">
               <span className="text-sm font-medium">Changes</span>
               <DiffStat additions={review.additions} deletions={review.deletions} />
               {review.truncated ? (
                  <span className="text-xs text-amber-600">
                     Diff is truncated to GitHub’s API limits.
                  </span>
               ) : null}
            </div>
            <FilesPanel review={review} />
         </aside>
      </div>
   );
}
