'use client';

import { Unavailable } from '@/components/common/unavailable';
import { CapacityRing } from '@/components/common/cycles/capacity-ring';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Issue } from '@/lib/domain/issues';
import { getCycleById } from '@/lib/domain/cycles';
import { Project } from '@/lib/domain/projects';
import { useProjectMilestones, useProjectUpdates, useTeams } from '@/hooks/use-workspace-data';
import { useProjectDetailActions } from '@/hooks/use-project-detail-actions';
import { PanelFilterTarget, usePanelFilter } from '@/components/common/issues/use-panel-filter';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ProjectProgressChart } from './project-progress-chart';
import { ArrowRight, Calendar, Check, Compass, Plus, Slack, Tag, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ProjectPropertiesPanelProps {
   project: Project;
   issues: Issue[];
}

const isCompleted = (issue: Issue) => issue.status.category === 'completed';

const formatDay = (iso?: string) => (iso ? format(parseISO(iso), 'MMM do') : '—');

interface BreakdownRow {
   key: string;
   label: string;
   leading: React.ReactNode;
   total: number;
   completedPercent: number;
   /** Click-to-filter target (exclusive, like the insights panel rows). */
   target?: PanelFilterTarget;
}

function buildRows<T>(
   issues: Issue[],
   keyOf: (issue: Issue) => T | undefined,
   describe: (key: T, sample: Issue) => Omit<BreakdownRow, 'total' | 'completedPercent'>
): BreakdownRow[] {
   const buckets = new Map<T, Issue[]>();
   for (const issue of issues) {
      const key = keyOf(issue);
      if (key === undefined) continue;
      buckets.set(key, [...(buckets.get(key) ?? []), issue]);
   }
   return [...buckets.entries()]
      .map(([key, bucket]) => ({
         ...describe(key, bucket[0]),
         total: bucket.length,
         completedPercent: Math.round((bucket.filter(isCompleted).length / bucket.length) * 100),
      }))
      .sort((a, b) => b.total - a.total);
}

function BreakdownList({
   rows,
   panelFilter,
}: {
   rows: BreakdownRow[];
   panelFilter: ReturnType<typeof usePanelFilter>;
}) {
   if (rows.length === 0) {
      return <p className="text-xs text-muted-foreground px-1 py-3">Nothing to show yet.</p>;
   }
   return (
      <div className="flex flex-col">
         {rows.map((row) => {
            const active = row.target ? panelFilter.isActive(row.target) : false;
            return (
               <button
                  key={row.key}
                  type="button"
                  onClick={() => row.target && panelFilter.toggle(row.target)}
                  className={cn(
                     'flex items-center justify-between gap-3 py-2 px-1.5 -mx-1.5 rounded-md text-left transition-colors',
                     row.target && 'cursor-pointer hover:bg-accent/50',
                     active && 'bg-accent hover:bg-accent'
                  )}
               >
                  <div className="flex items-center gap-2 min-w-0">
                     {row.leading}
                     <span className="text-sm truncate">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                     <CapacityRing value={row.completedPercent} color="#6771c5" />
                     <span className="whitespace-nowrap">
                        {row.completedPercent}% of {row.total}
                     </span>
                  </div>
               </button>
            );
         })}
      </div>
   );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
   return (
      <div className="flex items-center justify-between gap-4 min-h-7">
         <span className="text-sm text-muted-foreground shrink-0">{label}</span>
         <div className="flex items-center gap-1.5 text-sm min-w-0">{children}</div>
      </div>
   );
}

/**
 * Right-side panel of the project pages: properties, milestones,
 * progress breakdowns and a compact activity feed.
 */
export function ProjectPropertiesPanel({ project, issues }: ProjectPropertiesPanelProps) {
   const milestones = useProjectMilestones(project.id);
   const updates = useProjectUpdates(project.id);
   const { addMilestone, setMilestoneDone, removeMilestone } = useProjectDetailActions(
      project.id,
      project.teamId
   );
   const [addingMilestone, setAddingMilestone] = useState(false);
   const [milestoneDraft, setMilestoneDraft] = useState('');

   const teams = useTeams();
   const panelFilter = usePanelFilter();
   const completed = issues.filter(isCompleted).length;

   const team = teams.find((candidate) => candidate.id === project.teamId);

   const started = issues.filter((issue) => issue.status.category === 'started').length;

   const members = useMemo(() => {
      const seen = new Set<string>();
      return issues
         .map((issue) => issue.assignee)
         .filter((assignee): assignee is NonNullable<typeof assignee> => {
            if (!assignee || seen.has(assignee.id)) return false;
            seen.add(assignee.id);
            return true;
         });
   }, [issues]);

   const assigneeRows = useMemo(
      () =>
         buildRows(
            issues,
            (issue) => issue.assignee?.id ?? 'no-assignee',
            (key, sample) =>
               sample.assignee
                  ? {
                       key: String(key),
                       label: sample.assignee.name,
                       leading: (
                          <Avatar className="size-5 shrink-0">
                             <AvatarImage
                                src={sample.assignee.avatarUrl}
                                alt={sample.assignee.name}
                             />
                             <AvatarFallback>{sample.assignee.name[0]}</AvatarFallback>
                          </Avatar>
                       ),
                       target: { columnId: 'assignee', value: sample.assignee.id },
                    }
                  : {
                       key: 'no-assignee',
                       label: 'No assignee',
                       leading: null,
                       target: { columnId: 'assignee', value: 'unassigned' },
                    }
         ),
      [issues]
   );

   const labelRows = useMemo(
      () =>
         buildRows(
            issues,
            (issue) => issue.labels[0]?.id,
            (key, sample) => ({
               key: String(key),
               label: sample.labels[0]?.name ?? 'Unlabeled',
               leading: (
                  <span
                     className="size-2.5 rounded-full shrink-0"
                     style={{ backgroundColor: sample.labels[0]?.color ?? 'gray' }}
                  />
               ),
               target: { columnId: 'labels', value: String(key) },
            })
         ),
      [issues]
   );

   const cycleRows = useMemo(
      () =>
         buildRows(
            issues,
            (issue) => (issue.cycleId === '' ? undefined : issue.cycleId),
            (key) => ({
               key: String(key),
               label: getCycleById(String(key))?.name ?? `Cycle ${key}`,
               leading: null,
               target: { columnId: 'cycle', value: String(key) },
            })
         ),
      [issues]
   );

   return (
      <div className="flex flex-col h-full w-full overflow-y-auto">
         {/* Properties */}
         <div className="px-5 pt-4 pb-4 border-b">
            <h3 className="text-sm font-medium mb-2.5">Properties</h3>
            <div className="flex flex-col gap-1">
               <PropertyRow label="Status">
                  <project.status.icon />
                  <span>{project.status.name}</span>
               </PropertyRow>
               <PropertyRow label="Priority">
                  <project.priority.icon className="size-3.5 text-muted-foreground" />
                  <span>{project.priority.name}</span>
               </PropertyRow>
               <PropertyRow label="Lead">
                  <Avatar className="size-5">
                     <AvatarImage src={project.lead.avatarUrl} alt={project.lead.name} />
                     <AvatarFallback>{project.lead.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate max-w-36">{project.lead.name}</span>
               </PropertyRow>
               <PropertyRow label="Members">
                  {members.length > 0 ? (
                     <span className="inline-flex items-center gap-1.5">
                        <span className="flex -space-x-1.5">
                           {members.slice(0, 3).map((member) => (
                              <Avatar key={member.id} className="size-5 border-2 border-container">
                                 <AvatarImage src={member.avatarUrl} alt={member.name} />
                                 <AvatarFallback>{member.name[0]}</AvatarFallback>
                              </Avatar>
                           ))}
                        </span>
                        {members.length} {members.length === 1 ? 'member' : 'members'}
                     </span>
                  ) : (
                     <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <UserPlus className="size-3.5" />
                        Add members
                     </button>
                  )}
               </PropertyRow>
               <PropertyRow label="Dates">
                  <span className="inline-flex items-center gap-1">
                     <Calendar className="size-3.5 text-muted-foreground" />
                     {formatDay(project.startDate)}
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="inline-flex items-center gap-1">
                     <Calendar className="size-3.5 text-muted-foreground" />
                     {project.targetDate ? formatDay(project.targetDate) : 'Target'}
                  </span>
               </PropertyRow>
               <PropertyRow label="Teams">
                  <span className="inline-flex items-center gap-1.5">
                     {team?.icon} {team?.name ?? project.teamId}
                  </span>
               </PropertyRow>
               <PropertyRow label="Slack">
                  <Unavailable reason="There is no Slack integration yet">
                     <button
                        disabled
                        className="flex items-center gap-1.5 text-muted-foreground opacity-50"
                     >
                        <Slack className="size-3.5" />
                        Connect channel
                     </button>
                  </Unavailable>
               </PropertyRow>
               <PropertyRow label="Initiatives">
                  {project.initiative ? (
                     <span className="truncate max-w-44">{project.initiative}</span>
                  ) : (
                     <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Compass className="size-3.5" />
                        No initiative
                     </span>
                  )}
               </PropertyRow>
               <PropertyRow label="Labels">
                  <div className="flex items-center gap-1.5">
                     {project.labels.length === 0 && (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                           <Tag className="size-3.5" />
                           Add label
                        </span>
                     )}
                     {project.labels.map((label) => (
                        <span
                           key={label.id}
                           className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5"
                        >
                           <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: label.color }}
                           />
                           {label.name}
                        </span>
                     ))}
                     <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Plus className="size-3.5" />
                     </button>
                  </div>
               </PropertyRow>
            </div>
         </div>

         {/* Milestones */}
         <div className="px-5 py-4 border-b">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-sm font-medium">Milestones</h3>
               <button
                  aria-label="Add milestone"
                  onClick={() => setAddingMilestone(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
               >
                  <Plus className="size-3.5" />
               </button>
            </div>
            {addingMilestone && (
               <input
                  autoFocus
                  aria-label="New milestone name"
                  value={milestoneDraft}
                  placeholder="Milestone name"
                  onChange={(event) => setMilestoneDraft(event.target.value)}
                  onKeyDown={(event) => {
                     if (event.key === 'Enter') event.currentTarget.blur();
                     if (event.key === 'Escape') {
                        setMilestoneDraft('');
                        setAddingMilestone(false);
                     }
                  }}
                  onBlur={async () => {
                     const name = milestoneDraft.trim();
                     setMilestoneDraft('');
                     setAddingMilestone(false);
                     if (name) await addMilestone(name, milestones.length);
                  }}
                  className="w-full mb-2 text-sm bg-transparent outline-none rounded-md border px-2 py-1"
               />
            )}
            {milestones.length === 0 ? (
               <p className="text-xs text-muted-foreground">
                  Add milestones to organize work within your project and break it into more
                  granular stages. <span className="text-foreground/70 underline">Learn more</span>
               </p>
            ) : (
               <div className="flex flex-col gap-1.5">
                  {milestones.map((milestone) => (
                     <div
                        key={milestone.id}
                        className="group flex items-center justify-between gap-2 text-sm"
                     >
                        <span className="flex items-center gap-2 min-w-0">
                           <button
                              aria-label={`Toggle ${milestone.name}`}
                              onClick={() =>
                                 void setMilestoneDone(milestone.id, !milestone.completed)
                              }
                              className={
                                 milestone.completed
                                    ? 'size-4 rounded-full bg-violet-500 flex items-center justify-center shrink-0'
                                    : 'size-4 rounded-full border border-muted-foreground/40 shrink-0 hover:border-foreground'
                              }
                           >
                              {milestone.completed && <Check className="size-2.5 text-white" />}
                           </button>
                           <span
                              className={
                                 milestone.completed
                                    ? 'truncate line-through text-muted-foreground'
                                    : 'truncate'
                              }
                           >
                              {milestone.name}
                           </span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                           <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDay(milestone.targetDate)}
                           </span>
                           <button
                              aria-label={`Remove ${milestone.name}`}
                              onClick={() => void removeMilestone(milestone.id, milestone.name)}
                              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                           >
                              <X className="size-3" />
                           </button>
                        </span>
                     </div>
                  ))}
               </div>
            )}
         </div>

         {/* Progress */}
         <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-medium mb-3">Progress</h3>
            <div className="grid grid-cols-3 gap-2 mb-2">
               <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <span className="size-2 rounded-[2px] bg-[#8f9299]" />
                     Scope
                  </div>
                  <span className="text-sm font-medium">{issues.length}</span>
               </div>
               <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <span className="size-2 rounded-[2px] bg-[#facc15]" />
                     Started
                  </div>
                  <span className="text-sm font-medium">{started}</span>
               </div>
               <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                     <span className="size-2 rounded-[2px] bg-[#6771c5]" />
                     Completed
                  </div>
                  <span className="text-sm font-medium">{completed}</span>
               </div>
            </div>
            <div className="mb-3">
               <ProjectProgressChart
                  startDate={project.startDate}
                  endDate={project.targetDate ?? project.startDate}
                  scope={issues.length}
                  started={started}
                  completed={completed}
               />
            </div>
            <Tabs defaultValue="assignees">
               <TabsList className="h-8 bg-transparent gap-1 p-0">
                  <TabsTrigger value="assignees" className="text-xs px-2.5 rounded-full">
                     Assignees
                  </TabsTrigger>
                  <TabsTrigger value="labels" className="text-xs px-2.5 rounded-full">
                     Labels
                  </TabsTrigger>
                  <TabsTrigger value="cycles" className="text-xs px-2.5 rounded-full">
                     Cycles
                  </TabsTrigger>
               </TabsList>
               <TabsContent value="assignees">
                  <BreakdownList rows={assigneeRows} panelFilter={panelFilter} />
               </TabsContent>
               <TabsContent value="labels">
                  <BreakdownList rows={labelRows} panelFilter={panelFilter} />
               </TabsContent>
               <TabsContent value="cycles">
                  <BreakdownList rows={cycleRows} panelFilter={panelFilter} />
               </TabsContent>
            </Tabs>
         </div>

         {/* Activity */}
         <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-sm font-medium">Activity</h3>
               <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  See all
               </button>
            </div>
            {/* A project's real activity is the updates posted on it. The
                fixture here invented "x added themselves as a member" events
                for a membership model that does not exist. */}
            <div className="flex flex-col gap-3">
               {updates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                     Nothing yet. Posting an update on the Activity tab shows up here.
                  </p>
               ) : (
                  updates.slice(0, 6).map((update) => (
                     <div key={update.id} className="flex items-start gap-2 text-xs">
                        <Avatar className="size-4 mt-0.5 shrink-0">
                           <AvatarImage src={update.author.avatarUrl} alt={update.author.name} />
                           <AvatarFallback>{update.author.name[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-muted-foreground leading-relaxed">
                           <span className="text-foreground">{update.author.name}</span>{' '}
                           {update.health === 'no-update' ? 'commented' : 'posted an update'} ·{' '}
                           {formatDay(update.date)}
                        </p>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>
   );
}
