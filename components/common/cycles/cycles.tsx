'use client';

import { useCycles } from '@/hooks/use-workspace-data';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { format, parseISO } from 'date-fns';
import { Fragment } from 'react';
import { useParams } from 'next/navigation';
import CycleLine from './cycle-line';
import { CycleBurnupChart, CycleProgressLegend } from './cycle-burnup-chart';

/**
 * Cycles timeline: a date rail on the left and one row per cycle,
 * newest first. The current cycle is expanded with its burn-up chart.
 */
export default function Cycles() {
   const allCycles = useCycles();
   const { teamByKey } = useWorkspace();
   const { teamId: routeTeamId } = useParams<{ teamId: string }>();
   const teamId = teamByKey.get(routeTeamId)?.id ?? routeTeamId;
   const cycles = allCycles.filter((cycle) => cycle.teamId === teamId);

   if (cycles.length === 0) {
      return (
         <div className="flex h-64 flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm font-medium">No cycles yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
               Create a cycle from the button above, then assign issues to it to plan the team’s
               work.
            </p>
         </div>
      );
   }

   return (
      <div className="w-full py-4">
         {cycles.map((cycle) => (
            <Fragment key={cycle.id}>
               <div className="w-full flex items-stretch">
                  {/* Date rail */}
                  <div className="relative w-14 sm:w-20 shrink-0 flex flex-col items-end pr-4">
                     {/* Vertical rail, centered on the dots (pr-4 = 16px + half dot 5px - half line) */}
                     <div className="absolute right-[20.5px] top-0 bottom-0 w-px bg-border" />
                     <div className="flex items-center gap-2 h-12">
                        <span className="text-[11px] leading-tight text-muted-foreground text-right">
                           {format(parseISO(cycle.startDate), 'MMM')}
                           <br />
                           {format(parseISO(cycle.startDate), 'd')}
                        </span>
                        <span
                           className={
                              'relative z-10 size-2.5 rounded-full border-2 bg-background ' +
                              (cycle.status === 'current'
                                 ? 'border-indigo-400 bg-indigo-400'
                                 : 'border-muted-foreground/40')
                           }
                        />
                     </div>
                  </div>

                  {/* Cycle row + expanded chart for the current cycle */}
                  <div className="flex-1 min-w-0 border-b border-border/60">
                     <CycleLine cycle={cycle} teamCycles={cycles} />

                     {cycle.status === 'current' && (
                        <div className="flex flex-col lg:flex-row items-stretch gap-8 px-6 pb-6 pt-2">
                           <div className="flex-1 min-w-0">
                              <CycleBurnupChart cycle={cycle} height={220} />
                           </div>
                           <div className="lg:w-64 shrink-0 flex items-center">
                              <CycleProgressLegend cycle={cycle} />
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </Fragment>
         ))}
      </div>
   );
}
