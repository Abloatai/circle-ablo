'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

/** What can be watched. Matches the enum in `ablo/schema.ts`. */
export type SubscriptionEntityType = 'issue' | 'team' | 'project';

export interface SubscriptionRow {
   id: string;
   userId: string;
   entityType: SubscriptionEntityType;
   entityId: string;
}

/**
 * Every subscription in the workspace, not just the viewer's.
 *
 * The model is org-scoped on purpose: posting a comment has to notify the
 * other people watching the issue, and that write happens in the commenter's
 * browser, so their client needs to see subscriptions that are not their own.
 *
 * Read unconditionally — a selector that returns early subscribes to nothing
 * and never updates again.
 */
export function useSubscriptions(): SubscriptionRow[] {
   return (useAblo((ablo) => ablo.subscription.local.list({})) ?? []) as SubscriptionRow[];
}

/** The viewer's own subscription to one thing, if any. */
export function useIsSubscribed(entityType: SubscriptionEntityType, entityId?: string) {
   const rows = useSubscriptions();
   const { viewerId } = useWorkspace();
   return useMemo(() => {
      if (!entityId) return undefined;
      return rows.find(
         (row) =>
            row.userId === viewerId && row.entityType === entityType && row.entityId === entityId
      );
   }, [rows, viewerId, entityType, entityId]);
}

/** Everyone watching one thing. Used to decide who a notification reaches. */
export function useSubscriberIds(entityType: SubscriptionEntityType, entityId?: string): string[] {
   const rows = useSubscriptions();
   return useMemo(() => {
      if (!entityId) return [];
      return rows
         .filter((row) => row.entityType === entityType && row.entityId === entityId)
         .map((row) => row.userId);
   }, [rows, entityType, entityId]);
}

/**
 * Subscribing and unsubscribing.
 *
 * The unique index on (user_id, entity_type, entity_id) means subscribing
 * twice is the same fact, so the toggle removes the existing row rather than
 * writing a second one.
 */
export function useSubscriptionActions() {
   const ablo = useAblo();
   const { organizationId, viewerId } = useWorkspace();
   const rows = useSubscriptions();

   const toggle = useCallback(
      async (
         entityType: SubscriptionEntityType,
         entityId: string,
         label?: string
      ): Promise<boolean> => {
         if (!ablo) return false;
         const existing = rows.find(
            (row) =>
               row.userId === viewerId && row.entityType === entityType && row.entityId === entityId
         );
         const name = label ?? (entityType === 'team' ? 'team' : entityType);
         try {
            if (existing) {
               await ablo.subscription.delete({ id: existing.id });
               toast.success(`Unsubscribed from ${name}`);
               return false;
            }
            await ablo.subscription.create({
               data: { workspaceId: organizationId, userId: viewerId, entityType, entityId },
            });
            toast.success(`Subscribed to ${name}`);
            return true;
         } catch (error) {
            toast.error('Could not update the subscription', {
               description: error instanceof Error ? error.message : undefined,
            });
            return Boolean(existing);
         }
      },
      [ablo, rows, organizationId, viewerId]
   );

   return useMemo(() => ({ toggle }), [toggle]);
}
