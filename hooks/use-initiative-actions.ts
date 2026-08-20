'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { levelFromPriority } from '@/lib/data/hydrate';

/**
 * Writes to an initiative.
 *
 * Same shape as `useIssueActions`, and the same rule: **clearing a field means
 * `null`, never `undefined`.** An `undefined` is dropped from the payload
 * rather than written, so it reads as "leave this alone" and the old value
 * survives with no error.
 */
export function useInitiativeActions() {
   const ablo = useAblo();

   const update = useCallback(
      async (initiativeId: string, data: Record<string, unknown>, what: string) => {
         if (!ablo) return;
         try {
            await ablo.initiative.update({ id: initiativeId, data });
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
         setName: (id: string, name: string) => update(id, { name }, 'the name'),

         setDescription: (id: string, description: string) =>
            update(id, { description }, 'the description'),

         setIcon: (id: string, icon: string) => update(id, { icon }, 'the icon'),

         setStatus: (id: string, status: 'active' | 'planned' | 'completed') =>
            update(id, { status }, 'the status'),

         setPriority: (id: string, priorityId: string) =>
            update(id, { priority: levelFromPriority(priorityId) }, 'the priority'),

         setOwner: (id: string, ownerId: string | null) =>
            update(id, { ownerId: ownerId ?? null }, 'the owner'),

         setTarget: (id: string, target: string | null) =>
            update(id, { target: target ?? null }, 'the target'),

         setHealth: (id: string, health: 'no-update' | 'on-track' | 'at-risk' | 'off-track') =>
            update(id, { health }, 'the health'),

         /** Returns whether it went through — the caller usually navigates away. */
         remove: async (id: string, name: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               // `{ id }`, not `{ where: { id } }` — the wrong shape deletes
               // nothing and reports no error.
               await ablo.initiative.delete({ id });
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
      [update, ablo]
   );
}
