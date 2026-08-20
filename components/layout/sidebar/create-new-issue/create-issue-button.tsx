'use client';

import { RiEditLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useCreateIssueStore } from '@/store/create-issue-store';

/**
 * The sidebar's "new issue" button. It only opens the store — the dialog itself
 * is mounted once by `CreateIssueModalProvider`, so this cannot bring a second
 * copy of it along.
 */
export function CreateIssueButton() {
   const { openModal } = useCreateIssueStore();

   return (
      <Button
         className="size-8 shrink-0"
         variant="secondary"
         size="icon"
         aria-label="New issue"
         onClick={() => openModal()}
      >
         <RiEditLine />
      </Button>
   );
}
