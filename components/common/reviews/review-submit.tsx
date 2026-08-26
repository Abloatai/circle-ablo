'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { submitPullRequestReviewAction } from '@/app/[orgId]/review/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ReviewEvent } from '@/lib/domain/reviews';

export function ReviewSubmit({ orgId, reviewId }: { orgId: string; reviewId: string }) {
   const router = useRouter();
   const [body, setBody] = useState('');
   const [pending, startTransition] = useTransition();

   const submit = (event: ReviewEvent) => {
      startTransition(async () => {
         const result = await submitPullRequestReviewAction({ orgId, reviewId, event, body });
         if (!result.ok) {
            toast.error(result.error ?? 'Could not submit the review.');
            return;
         }
         setBody('');
         toast.success(
            event === 'APPROVE'
               ? 'Pull request approved on GitHub.'
               : event === 'REQUEST_CHANGES'
                 ? 'Changes requested on GitHub.'
                 : 'Review comment posted on GitHub.'
         );
         router.refresh();
      });
   };

   return (
      <div className="rounded-lg border p-3 flex flex-col gap-3">
         <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Leave an overall review comment…"
            maxLength={10_000}
            className="min-h-24 resize-y"
         />
         <div className="flex items-center justify-end gap-2">
            <Button
               size="sm"
               variant="outline"
               disabled={pending || body.trim().length === 0}
               onClick={() => submit('COMMENT')}
            >
               Comment
            </Button>
            <Button
               size="sm"
               variant="outline"
               disabled={pending || body.trim().length === 0}
               onClick={() => submit('REQUEST_CHANGES')}
            >
               Request changes
            </Button>
            <Button size="sm" disabled={pending} onClick={() => submit('APPROVE')}>
               Approve
            </Button>
         </div>
      </div>
   );
}
