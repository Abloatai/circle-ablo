'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Writes to a team's documents and folders.
 *
 * Both models are team-scoped, so `teamId` is what decides who sees the row —
 * it is taken from the page rather than from a row, the way every write path
 * here does.
 */
export function useDocumentActions(teamId: string) {
   const ablo = useAblo();
   const { organizationId } = useWorkspace();

   const update = useCallback(
      async (documentId: string, data: Record<string, unknown>, what: string) => {
         if (!ablo) return;
         try {
            await ablo.document.update({ id: documentId, data });
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
         /** Returns the new row's id, or undefined if the write was rejected. */
         createDocument: async (
            title: string,
            folderId?: string | null
         ): Promise<string | undefined> => {
            if (!ablo) return undefined;
            try {
               const created = await ablo.document.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     teamId,
                     title: title.trim() || 'Untitled',
                     icon: '📄',
                     content: '',
                     // A document filed nowhere gets no folder at all; the
                     // "Team documents" group it appears under is a rendering
                     // group with no row behind it.
                     ...(folderId ? { folderId } : {}),
                  },
               });
               return created.id;
            } catch (error) {
               toast.error('Could not create the document', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return undefined;
            }
         },

         setTitle: (id: string, title: string) => update(id, { title }, 'the title'),
         setIcon: (id: string, icon: string) => update(id, { icon }, 'the icon'),
         setContent: (id: string, content: string) => update(id, { content }, 'the document'),

         /** Moving out of every folder is `null`, not `undefined`. */
         setFolder: (id: string, folderId: string | null) =>
            update(id, { folderId: folderId || null }, 'the folder'),

         removeDocument: async (id: string, title: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.document.delete({ id });
               toast.success(`${title} deleted`);
               return true;
            } catch (error) {
               toast.error(`Could not delete ${title}`, {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },

         createFolder: async (name: string): Promise<string | undefined> => {
            if (!ablo) return undefined;
            try {
               const created = await ablo.documentFolder.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     teamId,
                     name: name.trim() || 'New folder',
                     icon: '📁',
                  },
               });
               return created.id;
            } catch (error) {
               toast.error('Could not create the folder', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return undefined;
            }
         },

         renameFolder: async (id: string, name: string) => {
            if (!ablo) return;
            try {
               await ablo.documentFolder.update({ id, data: { name } });
            } catch (error) {
               toast.error('Could not rename the folder', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },
      }),
      [ablo, organizationId, teamId, update]
   );
}
