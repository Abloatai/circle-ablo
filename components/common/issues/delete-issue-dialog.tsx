'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIssueActions } from '@/hooks/use-issue-actions';
import type { HydratedIssue } from '@/lib/data/hydrate';

/**
 * Confirms deleting an issue, then deletes it through Ablo.
 *
 * Deleting is the one issue write with no undo, so it asks first — and it says
 * how many sub-issues come with it, because those are easy to forget and
 * impossible to get back.
 */
export function DeleteIssueDialog({
   issue,
   subIssueCount = 0,
   open,
   onOpenChange,
   /** Where to go afterwards; omit to stay put (a list deletes in place). */
   redirectTo,
}: {
   issue: Pick<HydratedIssue, 'id' | 'identifier' | 'title'>;
   subIssueCount?: number;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   redirectTo?: string;
}) {
   const { remove } = useIssueActions();
   const router = useRouter();
   const [pending, setPending] = useState(false);

   async function confirm() {
      setPending(true);
      const deleted = await remove(issue.id, issue.identifier);
      setPending(false);
      if (!deleted) return;
      onOpenChange(false);
      if (redirectTo) router.push(redirectTo);
   }

   return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>Delete {issue.identifier}?</AlertDialogTitle>
               <AlertDialogDescription>
                  &ldquo;{issue.title}&rdquo; will be removed for everyone in the workspace.
                  {subIssueCount > 0 && (
                     <>
                        {' '}
                        Its {subIssueCount} sub-{subIssueCount === 1 ? 'issue' : 'issues'} will be
                        left without a parent.
                     </>
                  )}{' '}
                  This cannot be undone.
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
               <AlertDialogAction
                  onClick={(event) => {
                     // Keep the dialog up while the write is in flight, so a
                     // rejection can be shown rather than flashing past.
                     event.preventDefault();
                     void confirm();
                  }}
                  disabled={pending}
               >
                  {pending ? 'Deleting…' : 'Delete'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
