'use client';

import * as React from 'react';

import { NavInbox } from '@/components/layout/sidebar/nav-inbox';
import { NavTeams } from '@/components/layout/sidebar/nav-teams';
import { NavWorkspace } from '@/components/layout/sidebar/nav-workspace';
import { NavSettings } from '@/components/layout/sidebar/nav-settings';
import { NavTeamsSettings } from '@/components/layout/sidebar/nav-teams-settings';
import { OrgSwitcher } from '@/components/layout/sidebar/org-switcher';
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { BackToApp } from '@/components/layout/sidebar/back-to-app';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
   const pathname = usePathname();
   const isSettings = pathname.includes('/settings');
   return (
      <Sidebar collapsible="offcanvas" {...props}>
         <SidebarHeader>{isSettings ? <BackToApp /> : <OrgSwitcher />}</SidebarHeader>
         <SidebarContent>
            {isSettings ? (
               <>
                  <NavSettings />
                  <NavTeamsSettings />
               </>
            ) : (
               <>
                  <NavInbox />
                  <NavWorkspace />
                  <NavTeams />
               </>
            )}
         </SidebarContent>
      </Sidebar>
   );
}
