'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';
import type { ViewFilter, ViewType } from '@/lib/domain/views';

/**
 * Writes to a saved view.
 *
 * A view is workspace-scoped unless it names a team, which is how the same
 * model backs both the workspace Views page and a team's own. On a create the
 * team is simply omitted when there is none; on an update, moving a view back
 * to the workspace would have to send `null`, because `undefined` is dropped
 * from the payload and would leave the old team in place.
 */
export function useViewActions() {
   const ablo = useAblo();
   const { organizationId } = useWorkspace();

   const update = useCallback(
      async (viewId: string, data: Record<string, unknown>, what: string) => {
         if (!ablo) return;
         try {
            await ablo.savedView.update({ id: viewId, data });
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
            description?: string;
            icon?: string;
            type: ViewType;
            teamId?: string | null;
            filter: ViewFilter;
         }): Promise<string | undefined> => {
            if (!ablo) return undefined;
            try {
               const created = await ablo.savedView.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     name: input.name.trim() || 'Untitled view',
                     icon: input.icon || '🔍',
                     description: input.description?.trim() ?? '',
                     // Omitted rather than null: there is nothing to clear on a
                     // create, and the model types the field as optional.
                     ...(input.teamId ? { teamId: input.teamId } : {}),
                     // The type has no column of its own; it rides in the json
                     // beside the filter it describes.
                     filters: { type: input.type, filter: input.filter },
                  },
               });
               toast.success(`Saved ${input.name.trim() || 'view'}`);
               return created.id;
            } catch (error) {
               toast.error('Could not save the view', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return undefined;
            }
         },

         setName: (id: string, name: string) => update(id, { name }, 'the name'),
         setDescription: (id: string, description: string) =>
            update(id, { description }, 'the description'),
         setIcon: (id: string, icon: string) => update(id, { icon }, 'the icon'),

         setFilter: (id: string, type: ViewType, filter: ViewFilter) =>
            update(id, { filters: { type, filter } }, 'the filter'),

         remove: async (id: string, name: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.savedView.delete({ id });
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
