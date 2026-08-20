'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';

/**
 * Writes to a label.
 *
 * Deleting one does not unpick it from the issues carrying it — `labelIds` is a
 * json array on the issue, not a join table, so a removed label would linger as
 * an id that resolves to nothing. The caller checks the count first and the
 * delete is refused while any issue still uses it.
 */
export function useLabelActions() {
   const ablo = useAblo();

   return useMemo(
      () => ({
         setName: async (id: string, name: string) => {
            if (!ablo) return;
            try {
               await ablo.label.update({ id, data: { name } });
            } catch (error) {
               toast.error('Could not rename the label', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         setColor: async (id: string, color: string) => {
            if (!ablo) return;
            try {
               await ablo.label.update({ id, data: { color } });
            } catch (error) {
               toast.error('Could not recolour the label', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         remove: async (id: string, name: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.label.delete({ id });
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
      [ablo]
   );
}
