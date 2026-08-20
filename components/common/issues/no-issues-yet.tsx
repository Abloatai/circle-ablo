'use client';

import { RiEditLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useCreateIssueStore } from '@/store/create-issue-store';

/**
 * What a team with no issues shows.
 *
 * This is where a workspace lands straight after sign-up, and it used to say
 * "No issues to show." — a statement of fact with nothing to do about it, on a
 * page whose only create button was an unlabelled icon in the sidebar.
 */
export function NoIssuesYet({ filtered }: { filtered: boolean }) {
   const { openModal } = useCreateIssueStore();

   if (filtered) {
      return (
         <div className="flex flex-col items-center justify-center h-40 gap-1 text-sm text-muted-foreground">
            <p>No issues match these filters.</p>
         </div>
      );
   }

   return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
         <p className="text-sm font-medium">No issues yet</p>
         <p className="text-sm text-muted-foreground max-w-sm">
            Issues are the unit of work here — everything else hangs off them.
         </p>
         <Button size="sm" className="mt-1 gap-1.5" onClick={() => openModal()}>
            <RiEditLine className="size-4" />
            Create the first issue
         </Button>
         <p className="text-xs text-muted-foreground">
            or press <kbd className="rounded border px-1 py-0.5 font-mono text-[10px]">C</kbd>
         </p>
      </div>
   );
}
