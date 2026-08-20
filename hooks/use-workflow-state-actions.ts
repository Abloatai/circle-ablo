'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';
import type { StatusCategory } from '@/lib/domain/status';

/**
 * Writes to the workflow states — the statuses every issue points at.
 *
 * These are workspace reference data rather than a team's own rows, so the
 * write capability had to be added to the session grant before any of this
 * worked: `workflowState` was read-only, and a capability's operations are
 * fixed when the session is minted.
 */
export function useWorkflowStateActions() {
   const ablo = useAblo();
   const { organizationId } = useWorkspace();

   const update = useCallback(
      async (id: string, data: Record<string, unknown>, what: string) => {
         if (!ablo) return;
         try {
            await ablo.workflowState.update({ id, data });
         } catch (error) {
            toast.error(`Could not update ${what}`, {
               description: error instanceof Error ? error.message : undefined,
            });
         }
      },
      [ablo]
   );

   return useMemo(
      () => ({
         create: async (input: {
            name: string;
            color: string;
            category: StatusCategory;
            position: number;
         }): Promise<string | undefined> => {
            if (!ablo) return undefined;
            try {
               const created = await ablo.workflowState.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     name: input.name.trim() || 'New status',
                     color: input.color,
                     category: input.category,
                     position: input.position,
                  },
               });
               return created.id;
            } catch (error) {
               toast.error('Could not create the status', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return undefined;
            }
         },

         setName: (id: string, name: string) => update(id, { name }, 'the name'),
         setColor: (id: string, color: string) => update(id, { color }, 'the colour'),
         setCategory: (id: string, category: StatusCategory) =>
            update(id, { category }, 'the category'),
         setPosition: (id: string, position: number) => update(id, { position }, 'the order'),

         /**
          * Deletes a status. The caller must check nothing points at it first —
          * an issue whose `statusId` no longer resolves renders as "Unknown"
          * rather than failing, which is the kind of quiet wrongness this
          * codebase has been paying for.
          */
         remove: async (id: string, name: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.workflowState.delete({ id });
               toast.success(`${name} deleted`);
               return true;
            } catch (error) {
               toast.error(`Could not delete ${name}`, {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },
      }),
      [ablo, organizationId, update]
   );
}
