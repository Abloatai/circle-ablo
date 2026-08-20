'use client';

import { useEffect, useState } from 'react';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIssueActions } from '@/hooks/use-issue-actions';
import type { HydratedIssue } from '@/lib/data/hydrate';

/**
 * Renames an issue from the context menu.
 *
 * The issue page edits its title in place; from a list there is nowhere to edit
 * in place, so this is the same write behind a dialog. It seeds from the issue
 * each time it opens rather than holding a draft between openings — a stale
 * draft would quietly overwrite whatever changed in between.
 */
export function RenameIssueDialog({
   issue,
   open,
   onOpenChange,
}: {
   issue: Pick<HydratedIssue, 'id' | 'identifier' | 'title'>;
   open: boolean;
   onOpenChange: (open: boolean) => void;
}) {
   const { setTitle } = useIssueActions();
   const [draft, setDraft] = useState(issue.title);
   const [pending, setPending] = useState(false);

   useEffect(() => {
      if (open) setDraft(issue.title);
   }, [open, issue.title]);

   async function submit(event: React.FormEvent) {
      event.preventDefault();
      const next = draft.trim();
      if (!next || next === issue.title) {
         onOpenChange(false);
         return;
      }
      setPending(true);
      await setTitle(issue.id, next);
      setPending(false);
      onOpenChange(false);
   }

   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
               <DialogTitle>Rename {issue.identifier}</DialogTitle>
               <DialogDescription>Everyone in the workspace sees the new title.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
               <Input
                  autoFocus
                  aria-label="Issue title"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
               />
               <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                     Cancel
                  </Button>
                  <Button type="submit" disabled={pending || !draft.trim()}>
                     {pending ? 'Saving…' : 'Rename'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
