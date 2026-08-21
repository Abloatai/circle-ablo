'use client';

import { CyclePlayIcon } from '@/components/common/cycles/cycle-line';
import { Button } from '@/components/ui/button';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIssueActions } from '@/hooks/use-issue-actions';
import { useCycles } from '@/hooks/use-workspace-data';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';

interface CycleSelectorProps {
   cycleId: string;
   teamId?: string;
   issueId?: string;
   onChange?: (cycleId: string) => void;
   compact?: boolean;
}

/** Assign an issue to one of its team's cycles, or remove it from a cycle. */
export function CycleSelector({
   cycleId,
   teamId,
   issueId,
   onChange,
   compact = false,
}: CycleSelectorProps) {
   const [open, setOpen] = useState(false);
   const cycles = useCycles().filter((cycle) => !teamId || cycle.teamId === teamId);
   const selected = cycles.find((cycle) => cycle.id === cycleId);
   const { setCycle } = useIssueActions();

   const choose = (nextCycleId: string) => {
      onChange?.(nextCycleId);
      if (issueId) void setCycle(issueId, nextCycleId || null);
      setOpen(false);
   };

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button
               size="xs"
               variant={compact ? 'secondary' : 'ghost'}
               className={cn(!compact && '-ml-1.5 justify-start gap-2 px-1.5 font-normal')}
               role="combobox"
               aria-expanded={open}
               aria-label="Set cycle"
            >
               <CyclePlayIcon className="size-4" />
               <span>{selected?.name ?? 'No cycle'}</span>
            </Button>
         </PopoverTrigger>
         <PopoverContent className="w-64 p-0" align="start">
            <Command>
               <CommandInput placeholder="Set cycle…" />
               <CommandList>
                  <CommandEmpty>No cycles found for this team.</CommandEmpty>
                  <CommandGroup>
                     <CommandItem value="no-cycle" onSelect={() => choose('')}>
                        <CyclePlayIcon className="size-4" />
                        No cycle
                        {!cycleId && <CheckIcon className="ml-auto size-4" />}
                     </CommandItem>
                     {cycles.map((cycle) => (
                        <CommandItem
                           key={cycle.id}
                           value={`${cycle.name} ${cycle.id}`}
                           onSelect={() => choose(cycle.id)}
                        >
                           <CyclePlayIcon className="size-4" />
                           <span className="truncate">{cycle.name}</span>
                           <span className="ml-auto text-xs capitalize text-muted-foreground">
                              {cycle.status}
                           </span>
                           {cycle.id === cycleId && <CheckIcon className="size-4" />}
                        </CommandItem>
                     ))}
                  </CommandGroup>
               </CommandList>
            </Command>
         </PopoverContent>
      </Popover>
   );
}
