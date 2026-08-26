'use client';

import { Bot, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deployReviewTeamAction } from '@/app/[orgId]/review/actions';
import { Button } from '@/components/ui/button';

export function ReviewAgent({ orgId, reviewId }: { orgId: string; reviewId: string }) {
   const router = useRouter();
   const [pending, startTransition] = useTransition();

   const deploy = () => {
      startTransition(async () => {
         const result = await deployReviewTeamAction({ orgId, reviewId });
         router.refresh();
         if (!result.ok || !result.issueId) {
            toast.error('Review team could not start', {
               description: result.error ?? 'The review issue could not be prepared.',
            });
            return;
         }

         const issueHref = `/${orgId}/issue/${result.issueId}`;
         toast.success(
            result.alreadyRunning
               ? 'The review team is already working'
               : 'GPT and Claude are reviewing the pull request',
            {
               description: result.createdIssue
                  ? `${result.identifier} was created so you can follow the work.`
                  : `Follow the work in ${result.identifier}.`,
               action: {
                  label: 'Open issue',
                  onClick: () => router.push(issueHref),
               },
            }
         );
      });
   };

   return (
      <Button size="xs" onClick={deploy} disabled={pending}>
         {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
         {pending ? 'Deploying…' : 'Deploy review team'}
      </Button>
   );
}
