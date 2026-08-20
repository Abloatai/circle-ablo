import { InboxItem } from '@/lib/domain/inbox';
import { create } from 'zustand';

/**
 * Which notification is open in the reading pane.
 *
 * The notifications themselves are synced data and live in `useNotifications`;
 * only the selection is local, because it is a property of this browser tab
 * rather than of the workspace.
 */
interface NotificationsState {
   selectedNotification: InboxItem | undefined;
   setSelectedNotification: (notification: InboxItem | undefined) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
   selectedNotification: undefined,
   setSelectedNotification: (notification) => set({ selectedNotification: notification }),
}));
