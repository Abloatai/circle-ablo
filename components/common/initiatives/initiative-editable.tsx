'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInitiativeActions } from '@/hooks/use-initiative-actions';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { cn } from '@/lib/utils';
import {
   INITIATIVE_STATUS_META,
   type Initiative,
   type InitiativeStatus,
} from '@/lib/domain/initiatives';
import { priorities } from '@/lib/domain/priorities';
import { health as healthOptions } from '@/lib/domain/projects';
import { CalendarRange, UserRound } from 'lucide-react';
import { InitiativeStatusIcon } from './initiative-status-icon';

/**
 * One line of an initiative, edited in place.
 *
 * Saves on blur and only when the text actually changed, so clicking through
 * the page does not write. Someone else's rename wins while this is idle — the
 * draft resyncs from the prop — which is the behaviour you want when two people
 * have the same initiative open.
 */
function EditableLine({
   value,
   placeholder,
   label,
   onCommit,
   className,
}: {
   value: string;
   placeholder: string;
   label: string;
   onCommit: (next: string) => void;
   className?: string;
}) {
   const [draft, setDraft] = useState(value);
   const ref = useRef<HTMLTextAreaElement>(null);

   useEffect(() => setDraft(value), [value]);

   useEffect(() => {
      const node = ref.current;
      if (!node) return;
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
   }, [draft]);

   return (
      <textarea
         ref={ref}
         rows={1}
         value={draft}
         aria-label={label}
         placeholder={placeholder}
         onChange={(event) => setDraft(event.target.value)}
         onBlur={() => {
            const next = draft.trim();
            if (next === value.trim()) return;
            onCommit(next);
         }}
         onKeyDown={(event) => {
            if (event.key === 'Enter') {
               event.preventDefault();
               event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
               setDraft(value);
               event.currentTarget.blur();
            }
         }}
         className={cn(
            'w-full resize-none bg-transparent outline-none rounded-sm -mx-1 px-1',
            'hover:bg-accent/40 focus:bg-accent/40 transition-colors',
            'placeholder:text-muted-foreground',
            className
         )}
      />
   );
}

/** The initiative name, editable. */
export function InitiativeName({ initiative }: { initiative: Initiative }) {
   const { setName } = useInitiativeActions();
   return (
      <EditableLine
         value={initiative.name}
         placeholder="Initiative name"
         label="Initiative name"
         onCommit={(next) => next && void setName(initiative.id, next)}
         className="text-2xl font-semibold"
      />
   );
}

/** The one-line summary, editable. */
export function InitiativeDescription({ initiative }: { initiative: Initiative }) {
   const { setDescription } = useInitiativeActions();
   return (
      <EditableLine
         value={initiative.description ?? ''}
         placeholder="Add a short summary…"
         label="Initiative description"
         onCommit={(next) => void setDescription(initiative.id, next)}
         className="text-sm text-muted-foreground"
      />
   );
}

const STATUSES = Object.keys(INITIATIVE_STATUS_META) as InitiativeStatus[];

/** Status, priority, owner, target and health — each a menu that writes. */
export function InitiativeProperties({ initiative }: { initiative: Initiative }) {
   const { members } = useWorkspace();
   const { setStatus, setPriority, setOwner, setTarget, setHealth } = useInitiativeActions();
   const [editingTarget, setEditingTarget] = useState(false);

   const chip = 'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-accent';

   return (
      <div className="flex items-center gap-2 flex-wrap text-sm">
         <span className="text-muted-foreground text-xs w-24">Properties</span>

         <DropdownMenu>
            <DropdownMenuTrigger className={cn(chip, 'outline-none')}>
               <InitiativeStatusIcon status={initiative.status} />
               {INITIATIVE_STATUS_META[initiative.status].label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
               {STATUSES.map((candidate) => (
                  <DropdownMenuItem
                     key={candidate}
                     onClick={() => void setStatus(initiative.id, candidate)}
                  >
                     <InitiativeStatusIcon status={candidate} />
                     {INITIATIVE_STATUS_META[candidate].label}
                  </DropdownMenuItem>
               ))}
            </DropdownMenuContent>
         </DropdownMenu>

         <DropdownMenu>
            <DropdownMenuTrigger className={cn(chip, 'outline-none text-muted-foreground')}>
               <initiative.priority.icon className="size-4" />
               {initiative.priority.name}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
               {priorities.map((candidate) => (
                  <DropdownMenuItem
                     key={candidate.id}
                     onClick={() => void setPriority(initiative.id, candidate.id)}
                  >
                     <candidate.icon className="size-4" />
                     {candidate.name}
                  </DropdownMenuItem>
               ))}
            </DropdownMenuContent>
         </DropdownMenu>

         <DropdownMenu>
            <DropdownMenuTrigger className={cn(chip, 'outline-none')}>
               {initiative.owner ? (
                  <>
                     <Avatar className="size-4">
                        <AvatarImage src={initiative.owner.avatarUrl} alt={initiative.owner.name} />
                        <AvatarFallback className="text-[8px]">
                           {initiative.owner.name[0]}
                        </AvatarFallback>
                     </Avatar>
                     {initiative.owner.name}
                  </>
               ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                     <UserRound className="size-4" /> Owner
                  </span>
               )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
               {/* Clearing is `null`; `undefined` would leave the old owner. */}
               <DropdownMenuItem onClick={() => void setOwner(initiative.id, null)}>
                  <UserRound className="size-4" /> No owner
               </DropdownMenuItem>
               {members.map((member) => (
                  <DropdownMenuItem
                     key={member.id}
                     onClick={() => void setOwner(initiative.id, member.id)}
                  >
                     <Avatar className="size-4">
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                        <AvatarFallback className="text-[8px]">{member.name[0]}</AvatarFallback>
                     </Avatar>
                     {member.name}
                  </DropdownMenuItem>
               ))}
            </DropdownMenuContent>
         </DropdownMenu>

         {editingTarget ? (
            <input
               autoFocus
               aria-label="Initiative target"
               defaultValue={initiative.target ?? ''}
               placeholder="Q3 2026"
               className="w-28 bg-transparent outline-none rounded-md px-1.5 py-0.5 bg-accent/40"
               onBlur={(event) => {
                  const next = event.target.value.trim();
                  setEditingTarget(false);
                  if (next === (initiative.target ?? '')) return;
                  void setTarget(initiative.id, next || null);
               }}
               onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
               }}
            />
         ) : (
            <button
               className={cn(chip, 'text-muted-foreground')}
               onClick={() => setEditingTarget(true)}
            >
               <CalendarRange className="size-4" />
               {initiative.target || 'Target'}
            </button>
         )}

         <DropdownMenu>
            <DropdownMenuTrigger className={cn(chip, 'outline-none text-muted-foreground')}>
               <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: initiative.health.color }}
               />
               {initiative.health.name}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
               {healthOptions.map((candidate) => (
                  <DropdownMenuItem
                     key={candidate.id}
                     onClick={() => void setHealth(initiative.id, candidate.id)}
                  >
                     <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: candidate.color }}
                     />
                     {candidate.name}
                  </DropdownMenuItem>
               ))}
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}
