'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Team } from '@/lib/domain/teams';
import { useTeamsDisplayStore } from '@/store/teams-display-store';
import { format } from 'date-fns';
import { Box, Check, Play } from 'lucide-react';

interface TeamLineProps {
   team: Team;
   cycleCount: number;
}

const formatAuditDate = (value: string | undefined, pattern: string) =>
   value ? format(new Date(value), pattern) : '—';

export default function TeamLine({ team, cycleCount }: TeamLineProps) {
   const { displayProperties } = useTeamsDisplayStore();
   const uniqueProjects = new Set(team.projects.map((project) => project.id)).size;

   return (
      <div className="w-full flex items-center py-2.5 px-6 border-b hover:bg-sidebar/50 border-muted-foreground/5 text-sm">
         {/* Name + identifier */}
         <div className="flex-1 min-w-0 flex items-center gap-2.5">
            <span className="inline-flex size-6 bg-muted/50 items-center justify-center rounded shrink-0 text-sm">
               {team.icon}
            </span>
            <span className="font-medium truncate">{team.name}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
               {team.key ?? team.id}
            </span>
         </div>

         {displayProperties.membership && (
            <div className="hidden sm:block w-[110px] shrink-0">
               {team.joined && (
                  <span className="inline-flex items-center gap-1 text-xs border rounded-md px-1.5 py-0.5 text-muted-foreground">
                     <Check className="size-3" />
                     Joined
                  </span>
               )}
            </div>
         )}

         {displayProperties.owners && (
            <div className="hidden lg:block w-[70px] shrink-0 text-xs text-muted-foreground">—</div>
         )}

         {displayProperties.members && (
            <div className="w-[150px] shrink-0 flex items-center gap-1.5">
               {team.members.length > 0 && (
                  <>
                     <span className="flex -space-x-1.5">
                        {team.members.slice(0, 6).map((member) => (
                           <Avatar key={member.id} className="size-5 border-2 border-container">
                              <AvatarImage src={member.avatarUrl} alt={member.name} />
                              <AvatarFallback>{member.name[0]}</AvatarFallback>
                           </Avatar>
                        ))}
                     </span>
                     <span className="text-xs text-muted-foreground">{team.members.length}</span>
                  </>
               )}
            </div>
         )}

         {displayProperties.cycle && (
            <div className="hidden md:flex w-[80px] shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
               {cycleCount > 0 && (
                  <>
                     <Play className="size-3.5" />
                     {cycleCount}
                  </>
               )}
            </div>
         )}

         {displayProperties.projects && (
            <div className="hidden sm:flex w-[80px] shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
               <Box className="size-3.5" />
               {uniqueProjects}
            </div>
         )}

         {displayProperties.created && (
            <div className="hidden xl:block w-[90px] shrink-0 text-xs text-muted-foreground">
               {formatAuditDate(team.createdAt, 'MMM yyyy')}
            </div>
         )}

         {displayProperties.updated && (
            <div className="hidden xl:block w-[90px] shrink-0 text-xs text-muted-foreground">
               {formatAuditDate(team.updatedAt, 'MMM d')}
            </div>
         )}
      </div>
   );
}
