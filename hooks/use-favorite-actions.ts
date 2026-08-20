'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

/** What can be starred. Matches the enum in `ablo/schema.ts`. */
export type FavoriteEntityType = 'issue' | 'project' | 'cycle' | 'document' | 'view' | 'team';

export interface FavoriteRow {
   id: string;
   userId: string;
   entityType: FavoriteEntityType;
   entityId: string;
}

/**
 * The signed-in person's starred things.
 *
 * Read unconditionally and filtered afterwards: a selector that returns early
 * on a missing viewer id subscribes to nothing and never updates again. The
 * rows only ever belong to this person anyway — the model is user-scoped, so
 * nobody else's favourites reach this client.
 */
export function useFavorites(): FavoriteRow[] {
   const rows = useAblo((ablo) => ablo.favorite.local.list({})) ?? [];
   const { viewerId } = useWorkspace();

   return useMemo(
      () => (rows as FavoriteRow[]).filter((row) => row.userId === viewerId),
      [rows, viewerId]
   );
}

/** Whether one particular thing is starred, and its row id for the delete. */
export function useIsFavorite(entityType: FavoriteEntityType, entityId?: string) {
   const favorites = useFavorites();
   return useMemo(() => {
      if (!entityId) return undefined;
      return favorites.find((row) => row.entityType === entityType && row.entityId === entityId);
   }, [favorites, entityType, entityId]);
}

/**
 * Starring and unstarring.
 *
 * `toggle` is the only writer. The unique index on
 * (user_id, entity_type, entity_id) means starring twice is the same fact, so
 * the toggle deletes the existing row rather than adding a second one.
 */
export function useFavoriteActions() {
   const ablo = useAblo();
   const { organizationId, viewerId } = useWorkspace();
   const favorites = useFavorites();

   const toggle = useCallback(
      async (
         entityType: FavoriteEntityType,
         entityId: string,
         label?: string
      ): Promise<boolean> => {
         if (!ablo) return false;
         const existing = favorites.find(
            (row) => row.entityType === entityType && row.entityId === entityId
         );
         const name = label ?? 'Item';
         try {
            if (existing) {
               await ablo.favorite.delete({ id: existing.id });
               toast.success(`${name} removed from favorites`);
               return false;
            }
            await ablo.favorite.create({
               data: { workspaceId: organizationId, userId: viewerId, entityType, entityId },
            });
            toast.success(`${name} added to favorites`);
            return true;
         } catch (error) {
            toast.error('Could not update favorites', {
               description: error instanceof Error ? error.message : undefined,
            });
            return Boolean(existing);
         }
      },
      [ablo, favorites, organizationId, viewerId]
   );

   return useMemo(() => ({ toggle }), [toggle]);
}
