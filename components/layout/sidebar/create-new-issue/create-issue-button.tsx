'use client';

import { RiEditLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useCreateIssueStore } from '@/store/create-issue-store';

/**
 * The sidebar's "new issue" button. It only opens the store — the dialog itself
 * is mounted once by `CreateIssueModalProvider`, so this cannot bring a second
 * copy of it along.
 *
 * It carries its label rather than being a bare pencil. Creating an issue is
 * the first thing anyone does in a tracker, and an unlabelled icon made the
 * primary action of the product unfindable.
 */
export function CreateIssueButton() {
   const { openModal } = useCreateIssueStore();

   return (
      <Button
         className="shrink-0 gap-1.5"
         variant="secondary"
         size="sm"
         aria-label="New issue"
         title="New issue (C)"
         onClick={() => openModal()}
      >
         <RiEditLine className="size-4" />
         <span className="text-xs">New issue</span>
      </Button>
   );
}
