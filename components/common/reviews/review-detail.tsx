'use client';

import { Button } from '@/components/ui/button';
import type { Review } from '@/lib/domain/reviews';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ReviewAgent } from './review-agent';
import { ReviewDiff } from './review-diff';
import { ReviewOverview } from './review-overview';
import { DiffStat, IssueCheckIcon, PrIcon } from './review-shared';

export type ReviewSection = 'overview' | 'diff';

const SECTION_TABS: { key: ReviewSection; label: string; path: string }[] = [
   { key: 'overview', label: 'Overview', path: '' },
   { key: 'diff', label: 'Diff', path: '/changes' },
];

export function ReviewDetail({
   review,
   orgId,
   section,
}: {
   review: Review;
   orgId: string;
   section: ReviewSection;
}) {
   return (
      <div className="h-full flex flex-col overflow-hidden">
         <div className="flex items-center gap-2 px-4 h-10 border-b shrink-0 min-w-0">
            {review.linkedIssue ? (
               <Link
                  href={`/${orgId}/issue/${review.linkedIssue.id}`}
                  className="flex items-center gap-1.5 shrink-0 hover:opacity-80"
               >
                  <IssueCheckIcon />
                  <span className="text-sm font-medium">{review.linkedIssue.identifier}</span>
               </Link>
            ) : (
               <span className="text-xs text-muted-foreground shrink-0">{review.repository}</span>
            )}
            <span className="text-muted-foreground text-xs shrink-0">›</span>
            <PrIcon status={review.status} />
            <span className="text-sm font-medium truncate">{review.title}</span>
            <DiffStat additions={review.additions} deletions={review.deletions} />
         </div>
         <div className="flex items-center justify-between px-4 h-10 border-b shrink-0">
            <div className="flex items-center gap-1.5">
               {SECTION_TABS.map((tab) => (
                  <Link
                     key={tab.key}
                     href={`/${orgId}/review/${review.id}${tab.path}`}
                     className={cn(
                        'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
                        section === tab.key
                           ? 'bg-accent border-transparent'
                           : 'text-muted-foreground hover:bg-accent/50'
                     )}
                  >
                     {tab.label}
                  </Link>
               ))}
            </div>
            <div className="flex items-center gap-1">
               <ReviewAgent orgId={orgId} reviewId={review.id} />
               <Button size="xs" variant="ghost" asChild>
                  <a href={review.url} target="_blank" rel="noreferrer">
                     <ExternalLink className="size-3.5" />
                     Open in GitHub
                  </a>
               </Button>
            </div>
         </div>
         <div className="flex-1 min-h-0 overflow-hidden">
            {section === 'overview' ? (
               <ReviewOverview review={review} orgId={orgId} />
            ) : (
               <ReviewDiff review={review} />
            )}
         </div>
      </div>
   );
}
