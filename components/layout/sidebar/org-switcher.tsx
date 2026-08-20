'use client';

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';

import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuPortal,
   DropdownMenuSeparator,
   DropdownMenuShortcut,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { CreateIssueButton } from './create-new-issue/create-issue-button';
import { ThemeToggle } from '../theme-toggle';
import Link from 'next/link';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { signOut } from '@/lib/auth-client';

/** Two letters for the workspace badge: "LNDev UI" → "LN", "Acme" → "AC". */
function initials(name: string): string {
   const letters = name.replace(/[^a-zA-Z0-9]/g, '');
   return (letters.slice(0, 2) || '??').toUpperCase();
}

export function OrgSwitcher() {
   const { organizationName, organizationSlug, members, viewerId } = useWorkspace();
   const viewer = members.find((member) => member.id === viewerId);

   /**
    * Ends the session and leaves.
    *
    * A client-side navigation would keep the Ablo client and the synced pool of
    * the person who just left in memory, so this reloads onto the sign-in page
    * rather than routing to it.
    */
   async function logOut() {
      await signOut();
      window.location.href = '/sign-in';
   }

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <DropdownMenu>
               <div className="w-full flex gap-1 items-center pt-2">
                  <DropdownMenuTrigger asChild>
                     <SidebarMenuButton
                        size="lg"
                        className="h-8 p-1 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                     >
                        <div className="flex aspect-square size-6 items-center justify-center rounded bg-orange-500 text-sidebar-primary-foreground text-[11px] font-semibold">
                           {initials(organizationName)}
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                           <span className="truncate font-semibold">{organizationName}</span>
                        </div>
                        <ChevronsUpDown className="ml-auto" />
                     </SidebarMenuButton>
                  </DropdownMenuTrigger>

                  <ThemeToggle />

                  <CreateIssueButton />
               </div>
               <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
               >
                  <DropdownMenuGroup>
                     <DropdownMenuItem asChild>
                        <Link href={`/${organizationSlug}/settings`}>
                           Settings
                           <DropdownMenuShortcut>G then S</DropdownMenuShortcut>
                        </Link>
                     </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                        <Link href={`/${organizationSlug}/members`}>Invite and manage members</Link>
                     </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                     <DropdownMenuSubTrigger>Switch Workspace</DropdownMenuSubTrigger>
                     <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                           <DropdownMenuLabel>{viewer?.email ?? ''}</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem>
                              <div className="flex aspect-square size-6 items-center justify-center rounded bg-orange-500 text-sidebar-primary-foreground text-[11px] font-semibold">
                                 {initials(organizationName)}
                              </div>
                              {organizationName}
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem asChild>
                              <Link href="/onboarding">Create workspace</Link>
                           </DropdownMenuItem>
                        </DropdownMenuSubContent>
                     </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuItem onClick={() => void logOut()}>
                     Log out
                     <DropdownMenuShortcut>⌥⇧Q</DropdownMenuShortcut>
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}
