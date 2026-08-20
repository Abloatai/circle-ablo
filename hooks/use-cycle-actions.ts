'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';

/**
 * Writes to a cycle.
 *
 * Deleting one leaves the issues in it pointing at a cycle that no longer
 * exists — `cycleId` is a plain column, not a constraint — so the caller checks
 * the count first, the same way status deletion does.
 */
export function useCycleActions() {
   const ablo = useAblo();

   const update = async (id: string, data: Record<string, unknown>, what: string) => {
      if (!ablo) return;
      try {
         await ablo.cycle.update({ id, data });
      } catch (error) {
         toast.error(`Could not update ${what}`, {
            description: error instanceof Error ? error.message : undefined,
         });
      }
   };

   return useMemo(
      () => ({
         setName: (id: string, name: string) => update(id, { name }, 'the name'),
         setStatus: (id: string, status: 'completed' | 'current' | 'upcoming') =>
            update(id, { status }, 'the status'),
         setDates: (id: string, startDate: string, endDate: string) =>
            update(id, { startDate, endDate }, 'the dates'),

         remove: async (id: string, name: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.cycle.delete({ id });
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
      // `update` closes over `ablo` and nothing else.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [ablo]
   );
}
