'use client';

import {
   Archive,
   Bell,
   Box,
   ChevronRight,
   CopyMinus,
   Home,
   Layers,
   Link as LinkIcon,
   MoreHorizontal,
   Settings,
} from 'lucide-react';
import Link from 'next/link';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
   SidebarGroup,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuAction,
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarMenuSub,
   SidebarMenuSubButton,
   SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useTeams } from '@/hooks/use-workspace-data';
import { useSubscriptions, useSubscriptionActions } from '@/hooks/use-subscription-actions';
import { LeaveTeamDialog } from '@/components/common/settings/leave-dialogs';
import { useState } from 'react';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { toast } from 'sonner';
import { RiDonutChartFill } from '@remixicon/react';

/**
 * Puts a team's URL on the clipboard.
 *
 * Absolute, because the point of copying a link is to paste it somewhere that
 * is not this app.
 */
async function copyTeamLink(organizationSlug: string, teamId: string) {
   const url = `${window.location.origin}/${organizationSlug}/team/${teamId}/all`;
   try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
   } catch {
      // Clipboard access is refused outside a secure context; showing the URL
      // is more use than a failure nobody can act on.
      toast.error('Could not copy', { description: url });
   }
}

export function NavTeams() {
   const teams = useTeams();
   // The workspace slug is the first URL segment; hardcoding it sent every one
   // of these links to a workspace that only exists in the seed.
   const { organizationSlug, viewerId } = useWorkspace();
   const subscriptions = useSubscriptions();
   const { toggle: toggleSubscription } = useSubscriptionActions();
   const subscribedTeamIds = new Set(
      subscriptions
         .filter((row) => row.userId === viewerId && row.entityType === 'team')
         .map((row) => row.entityId)
   );
   // Which team the confirmation is for; null when the dialog is closed.
   const [leaving, setLeaving] = useState<{ id: string; name: string } | null>(null);
   const joinedTeams = teams.filter((t) => t.joined);
   return (
      <SidebarGroup>
         <SidebarGroupLabel>Your teams</SidebarGroupLabel>
         <SidebarMenu>
            {joinedTeams.map((item, index) => (
               <Collapsible
                  key={item.name}
                  asChild
                  defaultOpen={index === 0}
                  className="group/collapsible"
               >
                  <SidebarMenuItem>
                     <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.name}>
                           <div className="inline-flex size-6 bg-muted/50 items-center justify-center rounded shrink-0">
                              <div className="text-sm">{item.icon}</div>
                           </div>
                           <span className="text-sm">{item.name}</span>
                           {item.archived && (
                              <span
                                 className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
                                 title="Retired: readable, but it takes no new issues"
                              >
                                 Retired
                              </span>
                           )}
                           <span className="w-3 shrink-0">
                              <ChevronRight className="w-full transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                           </span>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <SidebarMenuAction asChild showOnHover>
                                    <div>
                                       <MoreHorizontal />
                                       <span className="sr-only">More</span>
                                    </div>
                                 </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                 className="w-48 rounded-lg"
                                 side="right"
                                 align="start"
                              >
                                 <DropdownMenuItem asChild>
                                    <Link href={`/${organizationSlug}/settings/teams/${item.id}`}>
                                       <Settings className="size-4" />
                                       <span>Team settings</span>
                                    </Link>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem
                                    onClick={() => void copyTeamLink(organizationSlug, item.id)}
                                 >
                                    <LinkIcon className="size-4" />
                                    <span>Copy link</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem>
                                    <Archive className="size-4" />
                                    <span>Open archive</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuSeparator />
                                 <DropdownMenuItem
                                    onClick={() =>
                                       void toggleSubscription('team', item.id, item.name)
                                    }
                                 >
                                    <Bell className="size-4" />
                                    <span>
                                       {subscribedTeamIds.has(item.id)
                                          ? 'Unsubscribe'
                                          : 'Subscribe'}
                                    </span>
                                 </DropdownMenuItem>
                                 <DropdownMenuSeparator />
                                 <DropdownMenuItem
                                    onClick={() => setLeaving({ id: item.id, name: item.name })}
                                 >
                                    <span>Leave team...</span>
                                 </DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </SidebarMenuButton>
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <SidebarMenuSub>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                 <Link href={`/${organizationSlug}/team/${item.id}/overview`}>
                                    <Home size={14} />
                                    <span>Home</span>
                                 </Link>
                              </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                 <Link href={`/${organizationSlug}/team/${item.id}/all`}>
                                    <CopyMinus size={14} />
                                    <span>Issues</span>
                                 </Link>
                              </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                 <Link href={`/${organizationSlug}/team/${item.id}/cycles`}>
                                    <RiDonutChartFill size={14} />
                                    <span>Cycles</span>
                                 </Link>
                              </SidebarMenuSubButton>
                              <SidebarMenuSub className="mr-0 pr-0">
                                 <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild>
                                       <Link
                                          href={`/${organizationSlug}/team/${item.id}/cycle/active`}
                                       >
                                          <span>Current</span>
                                       </Link>
                                    </SidebarMenuSubButton>
                                 </SidebarMenuSubItem>
                                 <SidebarMenuSubItem>
                                    <SidebarMenuSubButton asChild>
                                       <Link
                                          href={`/${organizationSlug}/team/${item.id}/cycle/upcoming`}
                                       >
                                          <span>Upcoming</span>
                                       </Link>
                                    </SidebarMenuSubButton>
                                 </SidebarMenuSubItem>
                              </SidebarMenuSub>
                           </SidebarMenuSubItem>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                 <Link href={`/${organizationSlug}/team/${item.id}/projects`}>
                                    <Box size={14} />
                                    <span>Projects</span>
                                 </Link>
                              </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                 <Link href={`/${organizationSlug}/team/${item.id}/views`}>
                                    <Layers size={14} />
                                    <span>Views</span>
                                 </Link>
                              </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                        </SidebarMenuSub>
                     </CollapsibleContent>
                  </SidebarMenuItem>
               </Collapsible>
            ))}
         </SidebarMenu>
         {leaving && (
            <LeaveTeamDialog
               teamId={leaving.id}
               teamName={leaving.name}
               open
               onOpenChange={(next) => !next && setLeaving(null)}
            />
         )}
      </SidebarGroup>
   );
}
