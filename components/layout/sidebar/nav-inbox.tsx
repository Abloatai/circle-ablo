'use client';

import {
   SidebarGroup,
   SidebarMenu,
   SidebarMenuBadge,
   SidebarMenuButton,
   SidebarMenuItem,
} from '@/components/ui/sidebar';
import { inboxItems } from '@/lib/domain/side-bar-nav';
import { REVIEWS_ENABLED } from '@/lib/features';
import { Unavailable } from '@/components/common/unavailable';
import { useNotifications } from '@/hooks/use-notifications';
import {
   isSidebarItemVisible,
   resolveOrder,
   SidebarItemKey,
   useSidebarPrefsStore,
} from '@/store/sidebar-prefs-store';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const ITEM_KEYS: Record<string, SidebarItemKey> = {
   'Inbox': 'inbox',
   'Reviews': 'reviews',
   'My issues': 'my-issues',
   'Agent': 'agent',
};

export function NavInbox() {
   const { orgId } = useParams<{ orgId: string }>();
   const { visibility, badgeStyle, order } = useSidebarPrefsStore();
   const { unreadCount } = useNotifications();
   const getUnreadCount = () => unreadCount;
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);

   const unread = mounted ? getUnreadCount() : 0;

   const orderedItems = mounted
      ? resolveOrder(order.personal, inboxItems.map((item) => ITEM_KEYS[item.name]).filter(Boolean))
           .map((key) => inboxItems.find((item) => ITEM_KEYS[item.name] === key))
           .filter((item): item is (typeof inboxItems)[number] => Boolean(item))
      : inboxItems;

   const items = orderedItems.filter((item) => {
      if (!mounted) return true;
      const key = ITEM_KEYS[item.name];
      if (!key) return true;
      const badge = key === 'inbox' ? unread : 0;
      return isSidebarItemVisible(visibility[key], badge);
   });

   return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
         <SidebarMenu>
            {items.map((item) => (
               <SidebarMenuItem key={item.name}>
                  {ITEM_KEYS[item.name] === 'reviews' && !REVIEWS_ENABLED ? (
                     // Not a link: the section renders from a fixture, so it
                     // would show the same six invented pull requests to
                     // everyone. Kept visible because the work is planned.
                     <Unavailable reason="Coming soon" className="w-full">
                        <SidebarMenuButton
                           aria-disabled="true"
                           className="opacity-50 pointer-events-none w-full"
                        >
                           <item.icon />
                           <span>{item.name}</span>
                        </SidebarMenuButton>
                     </Unavailable>
                  ) : (
                     <SidebarMenuButton asChild>
                        <Link href={`/${orgId}${item.url}`}>
                           <item.icon />
                           <span>{item.name}</span>
                        </Link>
                     </SidebarMenuButton>
                  )}
                  {mounted && item.name === 'Inbox' && unread > 0 && (
                     <SidebarMenuBadge className="text-muted-foreground">
                        {badgeStyle === 'count' ? (
                           unread > 99 ? (
                              '99+'
                           ) : (
                              unread
                           )
                        ) : (
                           <span className="size-1.5 rounded-full bg-muted-foreground inline-block" />
                        )}
                     </SidebarMenuBadge>
                  )}
               </SidebarMenuItem>
            ))}
         </SidebarMenu>
      </SidebarGroup>
   );
}
