'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePresence, type Presence } from '@/components/providers/presence-provider';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { cn } from '@/lib/utils';

/**
 * The green dot. Present only when the person actually has a socket open — an
 * absent dot means absent, not "we have not heard lately".
 */
export function PresenceDot({ userId, className }: { userId: string; className?: string }) {
   const presence = usePresence().byUserId.get(userId);
   if (!presence) return null;

   const away = presence.action === 'idle';
   return (
      <span
         className={cn(
            'size-1.5 rounded-full shrink-0',
            away ? 'bg-[#ffcc00]' : 'bg-[#00cc66]',
            className
         )}
      />
   );
}

/** The same dot, positioned to sit on the corner of an avatar. */
export function AvatarPresenceDot({ userId }: { userId: string }) {
   const presence = usePresence().byUserId.get(userId);
   if (!presence) return null;

   const away = presence.action === 'idle';
   return (
      <span
         className={cn(
            'border-background absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2',
            away ? 'bg-[#ffcc00]' : 'bg-[#00cc66]'
         )}
      />
   );
}

/** "Online now · CORE-142", or "Offline" when they are not connected. */
export function presenceLabelFor(presence: Presence | undefined): string {
   if (!presence) return 'Offline';
   if (presence.action === 'idle') return 'Away';

   const where = whereLabel(presence);
   return where ? `Online now · ${where}` : 'Online now';
}

/** What the person is looking at, in the words the UI already uses for it. */
export function whereLabel(presence: Presence): string | null {
   switch (presence.entityType) {
      case 'issue':
         return presence.entityId || null;
      case 'project':
         return 'a project';
      case 'team':
         return presence.detail ? `team · ${presence.detail}` : 'a team';
      case 'member':
         return 'a profile';
      case 'view':
         return presence.detail ?? null;
      default:
         return null;
   }
}

export function usePresenceLabel(userId: string): string {
   return presenceLabelFor(usePresence().byUserId.get(userId));
}

/**
 * Who is in the workspace right now, as a row of faces.
 *
 * Ordered with the viewer first and agents last, and capped — the point is a
 * glance that says "three other people are here", not a directory.
 */
export function LiveMembers({ max = 5 }: { max?: number }) {
   const { live } = usePresence();
   const { membersById, viewerId } = useWorkspace();

   // Someone can be connected without being in the members list yet (an
   // invitation accepted in another tab); they are real, so keep them.
   const ordered = [...live].sort((a, b) => {
      if (a.userId === viewerId) return -1;
      if (b.userId === viewerId) return 1;
      if (a.isAgent !== b.isAgent) return a.isAgent ? 1 : -1;
      return (membersById.get(a.userId)?.name ?? '').localeCompare(
         membersById.get(b.userId)?.name ?? ''
      );
   });

   const shown = ordered.slice(0, max);
   const overflow = ordered.length - shown.length;

   return (
      <TooltipProvider delayDuration={150}>
         <div className="flex items-center gap-1.5">
            <div className="flex items-center -space-x-1.5">
               {shown.map((presence) => {
                  const member = membersById.get(presence.userId);
                  const name = member?.name ?? 'Someone';
                  const where = whereLabel(presence);

                  return (
                     <Tooltip key={presence.userId}>
                        <TooltipTrigger asChild>
                           <span className="relative inline-flex">
                              <Avatar className="size-6 ring-2 ring-background">
                                 <AvatarImage src={member?.avatarUrl} alt={name} />
                                 <AvatarFallback className="text-[10px]">
                                    {name[0]?.toUpperCase()}
                                 </AvatarFallback>
                              </Avatar>
                              {presence.action === 'idle' && (
                                 <span className="border-background absolute -end-0.5 -bottom-0.5 size-2 rounded-full border bg-[#ffcc00]" />
                              )}
                           </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                           {presence.userId === viewerId ? `${name} (you)` : name}
                           {presence.action === 'idle' ? ' · away' : where ? ` · ${where}` : ''}
                        </TooltipContent>
                     </Tooltip>
                  );
               })}
            </div>

            {overflow > 0 && <span className="text-xs text-muted-foreground">+{overflow}</span>}
         </div>
      </TooltipProvider>
   );
}
