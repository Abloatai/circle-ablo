'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { levelFromPriority } from '@/lib/data/hydrate';

/**
 * Writes to an issue.
 *
 * Every one goes through Ablo rather than a local store: the change applies
 * optimistically, the promise resolves when the authoritative database has
 * confirmed it, and everyone else watching the team sees it arrive. A rejected
 * write rolls the local state back, so a failure has to be surfaced.
 *
 * **These writes deliberately do not take a claim.** Ablo's claims are for
 * holding a row across a gap — read it, reason about it, write it back — which
 * is the agent's shape, not this one. Here the patch is already decided when the
 * call is made, and Ablo merges at field level, so two participants editing
 * different fields of one issue both survive without any claim at all.
 *
 * Claiming per write was tried and reverted: several of these are fired without
 * being awaited (`void setStatus(...)`), so two quick clicks overlap, and the
 * second write arrives carrying a fencing token the first has already
 * superseded. Ablo rejects it — `claim_lost` — and the person sees "Could not
 * update the status" for two edits that used to both land. Measured, not
 * assumed: sequential claimed writes pass, overlapping ones from one client do
 * not.
 *
 * **Clearing a field means sending `null`, never `undefined`.** An `undefined`
 * is dropped from the payload rather than written, so it reads as "leave this
 * alone" and the old value survives — silently, with no error. Unassigning,
 * removing from a project or cycle, and clearing a due date all went through
 * this path and none of them did anything.
 */
export function useIssueActions() {
   const ablo = useAblo();

   const update = useCallback(
      async (
         issueId: string,
         data: Record<string, unknown>,
         what: string,
         /**
          * The claim held for the edit this write ends, when there was one.
          * Only the in-place editors take a claim — see `useFieldClaim` — so
          * this is undefined for a write decided by a picker.
          */
         claim?: unknown
      ) => {
         // Null only before the provider finishes its first bootstrap.
         if (!ablo) return;
         try {
            await ablo.issue.update({
               id: issueId,
               data,
               ...(claim ? { claim: claim as never } : {}),
            });
         } catch (error) {
            // The optimistic change has already been rolled back at this point.
            toast.error(`Could not update ${what}`, {
               description: error instanceof Error ? error.message : undefined,
            });
         }
      },
      [ablo]
   );

   return useMemo(
      () => ({
         setStatus: (issueId: string, statusId: string) =>
            update(issueId, { statusId }, 'the status'),

         setAssignee: (issueId: string, userId: string | null) =>
            update(issueId, { assigneeId: userId ?? null }, 'the assignee'),

         setPriority: (issueId: string, priorityId: string) =>
            update(issueId, { priority: levelFromPriority(priorityId) }, 'the priority'),

         setRank: (issueId: string, rank: string) => update(issueId, { rank }, 'the order'),

         setTitle: (issueId: string, title: string, claim?: unknown) =>
            update(issueId, { title }, 'the title', claim),

         /** Takes block JSON — see lib/data/content-blocks.ts for the editor's side. */
         setDescription: (issueId: string, description: string, claim?: unknown) =>
            update(issueId, { description }, 'the description', claim),

         setDueDate: (issueId: string, dueDate: string | null) =>
            update(issueId, { dueDate: dueDate ?? null }, 'the due date'),

         setLabels: (issueId: string, labelIds: string[]) =>
            update(issueId, { labelIds }, 'the labels'),

         setProject: (issueId: string, projectId: string | null) =>
            update(issueId, { projectId: projectId ?? null }, 'the project'),

         setCycle: (issueId: string, cycleId: string | null) =>
            update(issueId, { cycleId: cycleId ?? null }, 'the cycle'),

         /** Detaching a sub-issue means `null`, like every other clear. */
         setParent: (issueId: string, parentIssueId: string | null) =>
            update(issueId, { parentIssueId: parentIssueId ?? null }, 'the parent issue'),

         /**
          * Deletes the issue. Returns whether it went through, because the
          * caller usually has to navigate away and must not do so on failure.
          *
          * `delete()` takes `{ id }` — the `{ where: { id } }` shape is neither
          * a type error nor a runtime error, and deletes nothing.
          */
         remove: async (issueId: string, identifier: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.issue.delete({ id: issueId });
               toast.success(`${identifier} deleted`);
               return true;
            } catch (error) {
               toast.error(`Could not delete ${identifier}`, {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },
      }),
      [update, ablo]
   );
}
