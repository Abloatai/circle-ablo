'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIssues, useStatuses } from '@/hooks/use-workspace-data';
import { useWorkflowStateActions } from '@/hooks/use-workflow-state-actions';
import type { Status, StatusCategory } from '@/lib/domain/status';
import { SettingsShell } from './shared';

const CATEGORIES: { id: StatusCategory; label: string; color: string }[] = [
   { id: 'triage', label: 'Triage', color: '#e2a336' },
   { id: 'backlog', label: 'Backlog', color: '#95a2b3' },
   { id: 'unstarted', label: 'Unstarted', color: '#5e6ad2' },
   { id: 'started', label: 'Started', color: '#f2c94c' },
   { id: 'completed', label: 'Completed', color: '#4cb782' },
   { id: 'canceled', label: 'Canceled', color: '#95a2b3' },
];

/** One status: rename, recolour, reorder, delete. Each is its own write. */
function StatusRow({
   status,
   issueCount,
   canMoveUp,
   canMoveDown,
   onMove,
}: {
   status: Status;
   issueCount: number;
   canMoveUp: boolean;
   canMoveDown: boolean;
   onMove: (direction: -1 | 1) => void;
}) {
   const { setName, setColor, remove } = useWorkflowStateActions();
   const [name, setNameDraft] = useState(status.name);
   const [confirming, setConfirming] = useState(false);

   return (
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 last:border-b-0">
         <status.icon />
         <Input
            aria-label={`Name of ${status.name}`}
            value={name}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={() => {
               const next = name.trim();
               if (!next || next === status.name) {
                  setNameDraft(status.name);
                  return;
               }
               void setName(status.id, next);
            }}
            onKeyDown={(event) => {
               if (event.key === 'Enter') event.currentTarget.blur();
               if (event.key === 'Escape') {
                  setNameDraft(status.name);
                  event.currentTarget.blur();
               }
            }}
            className="h-8 border-none shadow-none px-1 focus-visible:ring-0 max-w-64"
         />

         <input
            type="color"
            aria-label={`Colour of ${status.name}`}
            value={status.color}
            onChange={(event) => void setColor(status.id, event.target.value)}
            className="size-6 rounded border bg-transparent p-0.5 cursor-pointer"
         />

         <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
         </span>

         <button
            aria-label={`Move ${status.name} up`}
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
         >
            <ChevronUp className="size-4" />
         </button>
         <button
            aria-label={`Move ${status.name} down`}
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
         >
            <ChevronDown className="size-4" />
         </button>
         <button
            aria-label={`Delete ${status.name}`}
            onClick={() => setConfirming(true)}
            className="text-muted-foreground hover:text-destructive"
         >
            <Trash2 className="size-4" />
         </button>

         <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Delete {status.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                     {issueCount > 0 ? (
                        <>
                           {issueCount} {issueCount === 1 ? 'issue is' : 'issues are'} in this
                           status. Move them somewhere else first — an issue pointing at a status
                           that no longer exists shows as &ldquo;Unknown&rdquo; rather than telling
                           anyone something is wrong.
                        </>
                     ) : (
                        'Nothing is in this status, so nothing will be left dangling.'
                     )}
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                     disabled={issueCount > 0}
                     onClick={(event) => {
                        event.preventDefault();
                        void remove(status.id, status.name).then((done) => {
                           if (done) setConfirming(false);
                        });
                     }}
                  >
                     Delete
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
}

/**
 * Workspace "Issue statuses" settings.
 *
 * Statuses are grouped by the category that drives every board, chart and
 * filter in the app; a status's category is what makes it count as "done", so
 * it is chosen when the status is created rather than being editable into
 * something the rest of the UI would silently reinterpret.
 */
export default function IssueStatusesSettings() {
   const statuses = useStatuses();
   const issues = useIssues();
   const { create, setPosition } = useWorkflowStateActions();
   const [adding, setAdding] = useState<StatusCategory | null>(null);
   const [newName, setNewName] = useState('');

   const counts = useMemo(() => {
      const map = new Map<string, number>();
      for (const issue of issues) map.set(issue.status.id, (map.get(issue.status.id) ?? 0) + 1);
      return map;
   }, [issues]);

   // `useStatuses` already orders by position; grouping preserves it.
   const grouped = useMemo(
      () =>
         CATEGORIES.map((category) => ({
            ...category,
            statuses: statuses.filter((status) => status.category === category.id),
         })),
      [statuses]
   );

   /** Swaps two neighbours' positions — two writes, both through Ablo. */
   async function move(list: Status[], index: number, direction: -1 | 1) {
      const a = list[index];
      const b = list[index + direction];
      if (!a || !b) return;
      const positionOf = (status: Status) => statuses.findIndex((s) => s.id === status.id);
      await Promise.all([setPosition(a.id, positionOf(b)), setPosition(b.id, positionOf(a))]);
   }

   return (
      <SettingsShell
         title="Issue statuses"
         description="The workflow every issue moves through. Each status belongs to a category, and the category is what the boards and charts count as done."
      >
         <div className="rounded-lg border bg-container overflow-hidden">
            {grouped.map((group) => (
               <div key={group.id}>
                  <div className="flex items-center justify-between px-4 py-2 bg-accent/30 border-y first:border-t-0 border-border/50">
                     <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <span
                           className="size-2 rounded-full"
                           style={{ backgroundColor: group.color }}
                        />
                        {group.label}
                     </span>
                     <button
                        aria-label={`New status in ${group.label}`}
                        onClick={() => {
                           setAdding(group.id);
                           setNewName('');
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                     >
                        <Plus className="size-3.5" />
                     </button>
                  </div>

                  {group.statuses.map((status, index) => (
                     <StatusRow
                        key={status.id}
                        status={status}
                        issueCount={counts.get(status.id) ?? 0}
                        canMoveUp={index > 0}
                        canMoveDown={index < group.statuses.length - 1}
                        onMove={(direction) => void move(group.statuses, index, direction)}
                     />
                  ))}

                  {adding === group.id && (
                     <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
                        <Input
                           autoFocus
                           aria-label="New status name"
                           value={newName}
                           placeholder={`New ${group.label.toLowerCase()} status`}
                           onChange={(event) => setNewName(event.target.value)}
                           onKeyDown={(event) => {
                              if (event.key === 'Escape') setAdding(null);
                              if (event.key === 'Enter') event.currentTarget.blur();
                           }}
                           onBlur={async () => {
                              const name = newName.trim();
                              setAdding(null);
                              if (!name) return;
                              await create({
                                 name,
                                 color: group.color,
                                 category: group.id,
                                 // Last within the workspace, which puts it last
                                 // in its group too.
                                 position: statuses.length,
                              });
                           }}
                           className="h-8 max-w-64"
                        />
                        <Button size="xs" variant="ghost" onClick={() => setAdding(null)}>
                           Cancel
                        </Button>
                     </div>
                  )}

                  {group.statuses.length === 0 && adding !== group.id && (
                     <p className="px-4 py-3 text-xs text-muted-foreground">
                        No statuses in {group.label.toLowerCase()}.
                     </p>
                  )}
               </div>
            ))}
         </div>
      </SettingsShell>
   );
}
