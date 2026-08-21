'use client';

import { useCallback, useMemo } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useAblo } from '@/lib/ablo';
import { useIssues } from '@/hooks/use-workspace-data';
import type { InboxItem, NotificationType } from '@/lib/domain/inbox';
import { toast } from 'sonner';

const EMPTY_ROWS: never[] = [];

/**
 * The signed-in person's inbox.
 *
 * A notification row is deliberately thin — who it is for, what happened, and
 * which issue it was about — and the issue itself is joined in from the synced
 * pool, so a notification never holds a stale copy of the issue's title or
 * status.
 */
export function useNotifications() {
   const ablo = useAblo();
   const issues = useIssues();
   const { membersById, viewerId } = useWorkspace();

   const rows =
      useAblo((client) => client.notification.local.list({ where: { userId: viewerId } })) ??
      EMPTY_ROWS;

   const notifications = useMemo<InboxItem[]>(() => {
      const issuesById = new Map(issues.map((issue) => [issue.id, issue]));

      return rows
         .map((row) => {
            const issue = row.issueId ? issuesById.get(row.issueId) : undefined;
            if (!issue) return undefined;
            const actor = row.actorId ? membersById.get(row.actorId) : undefined;
            const at = new Date((row as { createdAt?: string | Date }).createdAt ?? Date.now());

            return {
               ...issue,
               // The notification's own fields sit on top of the issue.
               id: row.id,
               content: describe(row.type as NotificationType, actor?.name),
               type: row.type as NotificationType,
               user: actor ?? membersById.get(viewerId)!,
               timestamp: formatDistanceToNowStrict(at),
               notificationCreatedAt: at.toISOString(),
               snoozedUntil: row.snoozedUntil
                  ? new Date(row.snoozedUntil).toISOString()
                  : undefined,
               read: Boolean(row.readAt),
               issueId: issue.id,
            } as InboxItem & { issueId: string };
         })
         .filter((item): item is InboxItem & { issueId: string } => Boolean(item))
         .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
   }, [rows, issues, membersById, viewerId]);

   const markAsRead = useCallback(
      async (id: string) => {
         if (!ablo) return;
         await ablo.notification.update({ id, data: { readAt: new Date() } });
      },
      [ablo]
   );

   const markAllAsRead = useCallback(async () => {
      if (!ablo) return;
      const now = new Date();
      await Promise.all(
         notifications
            .filter((notification) => !notification.read)
            .map((notification) =>
               ablo.notification.update({ id: notification.id, data: { readAt: now } })
            )
      );
   }, [ablo, notifications]);

   const removeNotifications = useCallback(
      async (predicate: (notification: InboxItem) => boolean) => {
         if (!ablo) return false;
         const matching = notifications.filter(predicate);
         if (matching.length === 0) return true;
         try {
            await Promise.all(
               matching.map((notification) => ablo.notification.delete({ id: notification.id }))
            );
            toast.success(
               `${matching.length} notification${matching.length === 1 ? '' : 's'} deleted`
            );
            return true;
         } catch (error) {
            toast.error('Could not delete notifications', {
               description: error instanceof Error ? error.message : undefined,
            });
            return false;
         }
      },
      [ablo, notifications]
   );

   return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
      markAsRead,
      markAllAsRead,
      deleteAll: () => removeNotifications(() => true),
      deleteRead: () => removeNotifications((notification) => notification.read),
      deleteCompleted: () =>
         removeNotifications((notification) => notification.status.category === 'completed'),
   };
}

function describe(type: NotificationType, actor: string | undefined): string {
   const who = actor ?? 'Someone';
   switch (type) {
      case 'assignment':
         return `${who} assigned this to you`;
      case 'comment':
         return `${who} commented`;
      case 'mention':
         return `${who} mentioned you`;
      case 'status':
         return `${who} changed the status`;
      case 'created':
         return `${who} created this`;
      default:
         return `${who} updated this`;
   }
}
