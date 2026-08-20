'use client';

import { Input } from '@/components/ui/input';
import { useIssues } from '@/hooks/use-workspace-data';
import { useLabels } from '@/hooks/use-workspace-data';
import { useEffect, useMemo, useState } from 'react';
import { SelectMenu } from './shared';
import { CreateLabel } from './create-label';
import { useLabelActions } from '@/hooks/use-label-actions';
import { FolderPlus, Trash2 } from 'lucide-react';
import { CreateGroup } from './create-group';
import { GroupSelect } from './group-select';

/** Invented descriptions for a few labels (Linear shows a Description column). */
const DESCRIPTIONS: Record<string, string> = {
   bug: 'Something is broken and needs a fix',
   accessibility: 'Keyboard, focus and screen-reader work',
   performance: 'Speed, memory and bundle size work',
};

const hashString = (value: string): number => {
   let hash = 0;
   for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
   return hash;
};

const LAST_APPLIED = [
   '12 minutes ago',
   '41 minutes ago',
   '3 hours ago',
   '17 hours ago',
   '2 days ago',
   '6 days ago',
];
const CREATED = ['Sep 2023', 'Jan 2024', 'Jun 2024', 'Feb 2025', 'Jun 2025', 'Jul 12'];

const formatCount = (count: number) =>
   count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);

/** The label's name, renamed in place. */
function LabelName({ label }: { label: { id: string; name: string } }) {
   const { setName } = useLabelActions();
   const [draft, setDraft] = useState(label.name);
   useEffect(() => setDraft(label.name), [label.name]);

   return (
      <input
         aria-label={`Name of ${label.name}`}
         value={draft}
         onChange={(event) => setDraft(event.target.value)}
         onBlur={() => {
            const next = draft.trim();
            if (!next || next === label.name) {
               setDraft(label.name);
               return;
            }
            void setName(label.id, next);
         }}
         onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
               setDraft(label.name);
               event.currentTarget.blur();
            }
         }}
         className="truncate bg-transparent outline-none rounded-sm px-1 -mx-1 hover:bg-accent/40 focus:bg-accent/40 transition-colors min-w-0"
      />
   );
}

/** Workspace "Issue labels" settings: filterable table of every label. */
export default function IssueLabelsSettings() {
   const labels = useLabels();
   const { setColor, remove } = useLabelActions();
   const issues = useIssues();
   const [query, setQuery] = useState('');
   const groups = useMemo(() => labels.filter((label) => label.isGroup), [labels]);
   const childCount = (groupId: string) =>
      labels.filter((label) => label.parentId === groupId).length;

   const rows = useMemo(() => {
      const counts = new Map<string, number>();
      for (const issue of issues) {
         for (const label of issue.labels) {
            counts.set(label.id, (counts.get(label.id) ?? 0) + 1);
         }
      }
      const decorate = (label: (typeof labels)[number]) => ({
         ...label,
         issues: counts.get(label.id) ?? 0,
         description: DESCRIPTIONS[label.id],
         lastApplied: LAST_APPLIED[hashString(label.id) % LAST_APPLIED.length],
         created: CREATED[hashString(label.name) % CREATED.length],
      });

      const matches = (label: { name: string }) =>
         label.name.toLowerCase().includes(query.toLowerCase());
      const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

      // Groups first, each followed by its own labels, then everything
      // ungrouped. A group whose name does not match the filter still shows
      // when one of its labels does, or the label would appear orphaned.
      const groups = labels.filter((label) => label.isGroup).sort(byName);
      const inGroup = (groupId: string) =>
         labels.filter((label) => label.parentId === groupId).sort(byName);

      const out: (ReturnType<typeof decorate> & { depth: number })[] = [];
      for (const group of groups) {
         const children = inGroup(group.id).filter(matches);
         if (!matches(group) && children.length === 0) continue;
         out.push({ ...decorate(group), depth: 0 });
         for (const child of matches(group) ? inGroup(group.id) : children) {
            out.push({ ...decorate(child), depth: 1 });
         }
      }
      for (const label of labels
         .filter((label) => !label.isGroup && !label.parentId)
         .filter(matches)
         .sort(byName)) {
         out.push({ ...decorate(label), depth: 0 });
      }
      return out;
      // `labels` and `issues` are live reads: without them here a rename or a
      // new label would not reach this table until something else re-rendered it.
   }, [labels, issues, query]);

   return (
      <div className="w-full overflow-y-auto h-full">
         <div className="max-w-5xl mx-auto px-6 py-10 pb-20">
            <h1 className="text-2xl font-medium mb-6">Issue labels</h1>

            <div className="flex items-center justify-between gap-3 mb-6">
               <div className="flex items-center gap-2">
                  <Input
                     placeholder="Filter by name..."
                     value={query}
                     onChange={(event) => setQuery(event.target.value)}
                     className="w-64 h-8"
                  />
                  <SelectMenu options={['Workspace', 'All teams']} />
               </div>
               <div className="flex items-center gap-2">
                  <CreateGroup />
                  <CreateLabel />
               </div>
            </div>

            {/* Header */}
            <div className="flex items-center px-2 py-1.5 text-xs text-muted-foreground border-b">
               <div className="flex-1 min-w-0">Name ↓</div>
               <div className="hidden md:block w-[260px]">Description</div>
               <div className="w-[70px]">Issues</div>
               <div className="hidden sm:block w-[110px]">Last applied</div>
               <div className="w-[80px]">Created</div>
            </div>

            {rows.map((label) => (
               <div
                  key={label.id}
                  className="flex items-center px-2 py-2.5 text-sm border-b border-muted-foreground/5 hover:bg-sidebar/50"
               >
                  <div
                     className="flex-1 min-w-0 flex items-center gap-2.5"
                     style={{ paddingLeft: label.depth * 22 }}
                  >
                     {label.isGroup ? (
                        <FolderPlus className="size-4 shrink-0 text-muted-foreground" />
                     ) : (
                        <input
                           type="color"
                           aria-label={`Colour of ${label.name}`}
                           value={label.color}
                           onChange={(event) => void setColor(label.id, event.target.value)}
                           className="size-4 rounded-full shrink-0 bg-transparent border-none p-0 cursor-pointer"
                        />
                     )}
                     <LabelName label={label} />
                     {label.isGroup && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                           Group
                        </span>
                     )}
                     {!label.isGroup && groups.length > 0 && (
                        <GroupSelect label={label} groups={groups} />
                     )}
                  </div>
                  <div className="hidden md:block w-[260px] text-xs text-muted-foreground truncate pr-4">
                     {label.description}
                  </div>
                  <div className="w-[70px] text-xs text-muted-foreground">
                     {label.issues > 0 && formatCount(label.issues)}
                  </div>
                  <div className="hidden sm:block w-[110px] text-xs text-muted-foreground">
                     {label.issues > 0 && label.lastApplied}
                  </div>
                  <div className="w-[80px] text-xs text-muted-foreground">{label.created}</div>
                  <button
                     aria-label={`Delete ${label.name}`}
                     title={
                        label.isGroup
                           ? childCount(label.id) > 0
                              ? `Move its ${childCount(label.id)} labels out first`
                              : 'Delete group'
                           : label.issues > 0
                             ? `${label.issues} issues still use this label`
                             : 'Delete label'
                     }
                     disabled={label.isGroup ? childCount(label.id) > 0 : label.issues > 0}
                     onClick={() => void remove(label.id, label.name)}
                     className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground"
                  >
                     <Trash2 className="size-3.5" />
                  </button>
               </div>
            ))}
            {rows.length === 0 && (
               <p className="text-sm text-muted-foreground py-6">No labels match your filter.</p>
            )}
         </div>
      </div>
   );
}
