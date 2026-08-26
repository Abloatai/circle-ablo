'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import type { Review, ReviewList, ReviewStatus, ReviewSummary } from '@/lib/domain/reviews';
import { cn } from '@/lib/utils';
import { ListFilter, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { ReviewDetail, type ReviewSection } from './review-detail';
import { PrIcon } from './review-shared';

function EmptySketch() {
   return (
      <svg width="150" height="120" viewBox="0 0 150 120" fill="none" aria-hidden>
         <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M28 78l58-22 34 30-64 16z" />
            <path d="M28 78l30-6 28 28" />
            <path d="M86 56l-8 40" strokeDasharray="4 4" />
            <path d="M104 34c8-10 22-12 26-6s-4 16-14 18" />
            <path d="M116 46c-4 2-8 2-12 0" />
            <path d="M44 66l6-2M56 84l6-2M70 92l6-2" strokeDasharray="3 4" />
         </g>
      </svg>
   );
}

const GROUP_LABELS: Record<ReviewStatus, string> = {
   open: 'Open',
   draft: 'Draft',
   merged: 'Merged',
   closed: 'Closed',
};

function ReviewRow({
   review,
   orgId,
   selected,
}: {
   review: ReviewSummary;
   orgId: string;
   selected: boolean;
}) {
   return (
      <Link
         href={`/${orgId}/review/${review.id}`}
         className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm border-b border-border/40 transition-colors',
            selected ? 'bg-accent/60' : 'hover:bg-sidebar/50'
         )}
      >
         <PrIcon status={review.status} />
         <span className="flex-1 min-w-0">
            <span className="block truncate">{review.title}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
               {review.repository}#{review.prNumber}
            </span>
         </span>
         <span className="text-xs text-muted-foreground shrink-0">{review.updatedLabel}</span>
      </Link>
   );
}

function ReviewGroup({
   label,
   count,
   children,
}: {
   label: string;
   count: number;
   children: ReactNode;
}) {
   const [open, setOpen] = useState(true);
   return (
      <div>
         <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="w-full flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[color-mix(in_oklab,var(--accent)_30%,var(--container))] border-b border-border/40 cursor-pointer select-none"
         >
            {label}
            <svg
               width="8"
               height="8"
               viewBox="0 0 8 8"
               className={cn(
                  'text-muted-foreground transition-transform duration-200',
                  !open && '-rotate-90'
               )}
               aria-hidden
            >
               <path d="M1 3l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            <span className="ml-auto text-muted-foreground font-normal">{count}</span>
         </button>
         <div
            className={cn(
               'grid transition-[grid-template-rows] duration-200 ease-out',
               open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
         >
            <div className="overflow-hidden">{children}</div>
         </div>
      </div>
   );
}

interface ReviewsProps {
   orgId: string;
   reviews: ReviewSummary[];
   connectedRepositories: number;
   failedRepositories?: number;
   listTab?: ReviewList;
   selectedReview?: Review;
   section?: ReviewSection;
}

export default function Reviews({
   orgId,
   reviews,
   connectedRepositories,
   failedRepositories = 0,
   listTab = 'open',
   selectedReview,
   section = 'overview',
}: ReviewsProps) {
   const source = reviews.filter((review) =>
      listTab === 'open'
         ? review.status === 'open' || review.status === 'draft'
         : review.status === 'merged' || review.status === 'closed'
   );
   const statusOrder: ReviewStatus[] =
      listTab === 'open' ? ['open', 'draft'] : ['merged', 'closed'];
   const groups = statusOrder
      .map((status) => ({
         label: GROUP_LABELS[status],
         items: source.filter((review) => review.status === status),
      }))
      .filter((group) => group.items.length > 0);

   return (
      <div className="w-full h-full flex overflow-hidden">
         <div className="w-[420px] max-w-[45%] shrink-0 border-r h-full flex flex-col bg-container">
            <div className="flex items-center justify-between px-4 py-1.5 h-10 border-b shrink-0">
               <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <span className="text-sm font-medium">Reviews</span>
               </div>
               <div className="flex items-center gap-2 text-muted-foreground">
                  <ListFilter className="size-4" />
                  <SlidersHorizontal className="size-4" />
               </div>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 shrink-0">
               <Link
                  href={`/${orgId}/reviews`}
                  className={cn(
                     'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
                     listTab === 'open'
                        ? 'bg-accent border-transparent'
                        : 'text-muted-foreground hover:bg-accent/50'
                  )}
               >
                  Open
               </Link>
               <Link
                  href={`/${orgId}/reviews/created`}
                  className={cn(
                     'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
                     listTab === 'completed'
                        ? 'bg-accent border-transparent'
                        : 'text-muted-foreground hover:bg-accent/50'
                  )}
               >
                  Completed
               </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
               {failedRepositories > 0 ? (
                  <p className="px-4 py-2 text-xs text-amber-600 border-b">
                     {failedRepositories} connected repository could not be refreshed.
                  </p>
               ) : null}
               {groups.map((group) => (
                  <ReviewGroup key={group.label} label={group.label} count={group.items.length}>
                     {group.items.map((review) => (
                        <ReviewRow
                           key={review.id}
                           review={review}
                           orgId={orgId}
                           selected={review.id === selectedReview?.id}
                        />
                     ))}
                  </ReviewGroup>
               ))}
            </div>
         </div>

         <div className="flex-1 min-w-0 h-full overflow-hidden">
            {selectedReview ? (
               <ReviewDetail review={selectedReview} orgId={orgId} section={section} />
            ) : (
               <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground px-8 text-center">
                  <EmptySketch />
                  {connectedRepositories === 0 ? (
                     <>
                        <span className="text-sm">
                           No GitHub repositories are mapped to your teams.
                        </span>
                        <Link
                           href={`/${orgId}/settings/integrations`}
                           className="text-sm text-primary hover:underline"
                        >
                           Configure GitHub integration
                        </Link>
                     </>
                  ) : (
                     <span className="text-sm">
                        No {listTab === 'open' ? 'open' : 'completed'} pull requests.
                     </span>
                  )}
               </div>
            )}
         </div>
      </div>
   );
}
