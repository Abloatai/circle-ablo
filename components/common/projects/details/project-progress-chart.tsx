'use client';

import { format, parseISO } from 'date-fns';

interface ProjectProgressChartProps {
   startDate: string;
   endDate: string;
   scope: number;
   started: number;
   completed: number;
}

/** Show the current snapshot without inventing progress history. */
export function ProjectProgressChart({
   startDate,
   endDate,
   scope,
   started,
   completed,
}: ProjectProgressChartProps) {
   const remaining = Math.max(0, scope - started - completed);
   const percent = (value: number) => (scope > 0 ? `${(value / scope) * 100}%` : '0%');

   return (
      <div>
         <div className="flex h-[130px] flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4">
            <p className="text-xs text-muted-foreground">No progress history yet</p>
            <div className="flex h-2 w-full max-w-56 overflow-hidden rounded-full bg-muted">
               <span className="bg-indigo-500" style={{ width: percent(completed) }} />
               <span className="bg-yellow-400" style={{ width: percent(started) }} />
               <span className="bg-muted-foreground/30" style={{ width: percent(remaining) }} />
            </div>
         </div>
         <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
            <span>{format(parseISO(startDate), 'MMM d')}</span>
            <span>{format(parseISO(endDate), 'MMM d')}</span>
         </div>
      </div>
   );
}
