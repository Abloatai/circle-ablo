'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

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
   const { organizationId } = useWorkspace();

   return useMemo(
      () => ({
         /** Creates a group: a label that holds labels and is never applied. */
         createGroup: async (name: string, color = '#95a2b3'): Promise<string | null> => {
            if (!ablo) return null;
            try {
               const created = await ablo.label.create({
                  data: { workspaceId: organizationId, name, color, isGroup: true },
               });
               toast.success(`${name} group created`);
               return created.id;
            } catch (error) {
               toast.error('Could not create the group', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return null;
            }
         },

         /** Moves a label into a group, or out of one with `null`. */
         setGroup: async (id: string, parentId: string | null) => {
            if (!ablo) return;
            try {
               // `null` clears it; `undefined` would be dropped from the
               // payload and leave the old group in place. The generated type
               // says `string | undefined`, so the payload is widened the same
               // way `use-issue-actions` widens an unassign.
               await ablo.label.update({
                  id,
                  data: { parentId } as unknown as Record<string, never>,
               });
            } catch (error) {
               toast.error('Could not move the label', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

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
      [ablo, organizationId]
   );
}
