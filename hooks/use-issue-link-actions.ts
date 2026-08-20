'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

/** What the panel offers, which is not quite what the model stores. */
export type LinkRelation = 'blocks' | 'blocked-by' | 'related' | 'duplicates';

export const LINK_RELATION_LABEL: Record<LinkRelation, string> = {
   'blocks': 'Blocking',
   'blocked-by': 'Blocked by',
   'related': 'Related',
   'duplicates': 'Duplicates',
};

/**
 * Links an issue to another issue.
 *
 * A `blocks` row is directional, and "blocked by" is that same row read from
 * the other end rather than a second row that could drift out of agreement with
 * the first. So linking "this is blocked by X" writes a row whose `issueId` is
 * **X** — the blocker — and whose `relatedIssueId` is the issue you are looking
 * at. Getting that backwards produces a link that renders in the wrong section
 * on both issues, which is the sort of thing that looks fine until someone
 * relies on it.
 */
export function useIssueLinkActions() {
   const ablo = useAblo();
   const { organizationId } = useWorkspace();

   return useMemo(
      () => ({
         link: async (input: {
            issueId: string;
            otherIssueId: string;
            relation: LinkRelation;
            teamId: string;
         }): Promise<boolean> => {
            if (!ablo) return false;
            if (input.issueId === input.otherIssueId) {
               toast.error('An issue cannot be linked to itself');
               return false;
            }
            // "blocked by" is a `blocks` row pointing the other way.
            const reversed = input.relation === 'blocked-by';
            const type = reversed
               ? 'blocks'
               : input.relation === 'blocks'
                 ? 'blocks'
                 : input.relation;
            try {
               await ablo.issueLink.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     teamId: input.teamId,
                     issueId: reversed ? input.otherIssueId : input.issueId,
                     relatedIssueId: reversed ? input.issueId : input.otherIssueId,
                     type: type as 'blocks' | 'related' | 'duplicates',
                  },
               });
               return true;
            } catch (error) {
               toast.error('Could not link the issue', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },

         unlink: async (linkId: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               // `{ id }`, not `{ where: { id } }` — the wrong shape deletes
               // nothing and reports no error.
               await ablo.issueLink.delete({ id: linkId });
               return true;
            } catch (error) {
               toast.error('Could not remove the link', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },
      }),
      [ablo, organizationId]
   );
}
