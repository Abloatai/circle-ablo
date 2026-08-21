'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Initiative } from '@/lib/domain/initiatives';
import { initiativeProjects } from '@/lib/data/initiatives';
import { useProjects } from '@/hooks/use-workspace-data';
import { health as allHealth } from '@/lib/domain/projects';
import { useTeams } from '@/hooks/use-workspace-data';
import { useMemo, useState } from 'react';

type BreakdownTab = 'health' | 'status' | 'teams' | 'leads';

/** Progress area chart + Health/Status/Teams/Leads breakdown of an initiative. */
export function InitiativeProgressPanel({ initiative }: { initiative: Initiative }) {
   const teams = useTeams();
   const [tab, setTab] = useState<BreakdownTab>('teams');
   const allProjects = useProjects();
   const projects = useMemo(
      () => initiativeProjects(initiative, allProjects),
      [initiative, allProjects]
   );

   const rows = useMemo(() => {
      if (tab === 'teams') {
         const byTeam = new Map<string, number>();
         for (const project of projects) {
            byTeam.set(project.teamId, (byTeam.get(project.teamId) ?? 0) + 1);
         }
         return [...byTeam.entries()].map(([teamId, count]) => {
            const team = teams.find((entry) => entry.id === teamId);
            return { key: teamId, icon: team?.icon ?? '👥', label: team?.name ?? teamId, count };
         });
      }
      if (tab === 'leads') {
         const byLead = new Map<string, { label: string; avatarUrl?: string; count: number }>();
         for (const project of projects) {
            const existing = byLead.get(project.lead.id);
            if (existing) existing.count += 1;
            else
               byLead.set(project.lead.id, {
                  label: project.lead.name,
                  avatarUrl: project.lead.avatarUrl,
                  count: 1,
               });
         }
         return [...byLead.entries()].map(([key, row]) => ({ key, ...row, icon: undefined }));
      }
      if (tab === 'status') {
         const byStatus = new Map<string, { label: string; color: string; count: number }>();
         for (const project of projects) {
            const existing = byStatus.get(project.status.id);
            if (existing) existing.count += 1;
            else
               byStatus.set(project.status.id, {
                  label: project.status.name,
                  color: project.status.color,
                  count: 1,
               });
         }
         return [...byStatus.entries()].map(([key, row]) => ({ key, ...row, icon: undefined }));
      }
      return allHealth
         .map((entry) => ({
            key: entry.id,
            label: entry.name,
            color: entry.color,
            icon: undefined,
            count: projects.filter((project) => project.health.id === entry.id).length,
         }))
         .filter((row) => row.count > 0);
   }, [tab, projects, teams]);

   return (
      <div className="flex flex-col gap-3">
         <span className="text-sm font-medium">Progress</span>
         <div className="flex h-44 -mx-2 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            No progress history yet
         </div>
         <div className="flex items-center gap-1.5 flex-wrap">
            {(
               [
                  ['health', 'Health'],
                  ['status', 'Status'],
                  ['teams', 'Teams'],
                  ['leads', 'Leads'],
               ] as const
            ).map(([key, label]) => (
               <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                     'px-2.5 py-1 rounded-full border text-xs font-medium transition-colors',
                     tab === key
                        ? 'bg-accent border-transparent'
                        : 'text-muted-foreground hover:bg-accent/50'
                  )}
               >
                  {label}
               </button>
            ))}
         </div>
         <div className="flex flex-col gap-1">
            {rows.map((row) => (
               <div key={row.key} className="flex items-center gap-2 text-sm py-1">
                  {'avatarUrl' in row && row.avatarUrl ? (
                     <Avatar className="size-5">
                        <AvatarImage src={row.avatarUrl} alt={row.label} />
                        <AvatarFallback className="text-[9px]">{row.label[0]}</AvatarFallback>
                     </Avatar>
                  ) : 'color' in row && row.color ? (
                     <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                     />
                  ) : (
                     <span className="text-sm">{row.icon}</span>
                  )}
                  <span className="flex-1 truncate">{row.label}</span>
                  <span className="text-muted-foreground text-xs">{row.count}</span>
               </div>
            ))}
         </div>
      </div>
   );
}
