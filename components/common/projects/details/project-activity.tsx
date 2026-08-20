'use client';

import { Unavailable } from '@/components/common/unavailable';
import { ContentBlocks } from '@/components/common/issues/details/content-blocks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useAblo } from '@/lib/ablo';
import { cn } from '@/lib/utils';
import {
   postableHealth,
   ProjectUpdateHealth,
   projectUpdateHealthColor,
   projectUpdateHealthLabel,
} from '@/lib/domain/project-details';
import {
   useIssues,
   useProjects,
   useProjectUpdates,
   type ProjectUpdateItem,
} from '@/hooks/use-workspace-data';
import { ProjectMissing } from './project-missing';
import { format, parseISO } from 'date-fns';
import { Paperclip, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ProjectSidePanel } from './project-side-panel';

interface ProjectActivityProps {
   projectId: string;
}

function HealthBadge({ health }: { health: ProjectUpdateHealth }) {
   return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-2 py-0.5">
         <span
            className="size-2 rounded-full"
            style={{ backgroundColor: projectUpdateHealthColor[health] }}
         />
         {projectUpdateHealthLabel[health]}
      </span>
   );
}

function UpdateCard({ update }: { update: ProjectUpdateItem }) {
   return (
      <div className="border rounded-lg p-4">
         <div className="flex items-center gap-2 text-sm">
            <Avatar className="size-5">
               <AvatarImage src={update.author.avatarUrl} alt={update.author.name} />
               <AvatarFallback>{update.author.name[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{update.author.name}</span>
            <span className="text-xs text-muted-foreground">
               {format(parseISO(update.date), 'MMM d')}
            </span>
            {update.health !== 'no-update' && (
               <span className="ml-auto">
                  <HealthBadge health={update.health} />
               </span>
            )}
         </div>
         <div className="mt-2 text-sm leading-relaxed">
            <ContentBlocks blocks={update.blocks} />
         </div>
      </div>
   );
}

/** Project "Activity" tab: update composer + monthly timeline. */
export default function ProjectActivity({ projectId }: ProjectActivityProps) {
   const allProjects = useProjects();
   const getProjectById = (id: string) => allProjects.find((project) => project.id === id);
   const project = getProjectById(projectId);
   const allIssues = useIssues();
   const issues = useMemo(
      () => allIssues.filter((issue) => issue.project?.id === projectId),
      [allIssues, projectId]
   );
   const ablo = useAblo();
   const { viewerId, organizationId } = useWorkspace();
   const updates = useProjectUpdates(projectId);
   const [mode, setMode] = useState<'comment' | 'update'>('update');
   const [health, setHealth] = useState<ProjectUpdateHealth>('on-track');
   const [text, setText] = useState('');
   const [pending, setPending] = useState(false);

   const updatesByMonth = useMemo(() => {
      const groups = new Map<string, ProjectUpdateItem[]>();
      for (const update of updates) {
         const month = format(parseISO(update.date), 'MMMM');
         groups.set(month, [...(groups.get(month) ?? []), update]);
      }
      return [...groups.entries()];
   }, [updates]);

   if (!project) return <ProjectMissing projectId={projectId} />;

   const completedPercent =
      issues.length > 0
         ? Math.round(
              (issues.filter((issue) => issue.status.category === 'completed').length /
                 issues.length) *
                 100
           )
         : 0;

   /**
    * Posting is an Ablo write, so the update survives a reload and reaches
    * everyone else on the team. An update also *is* the project's health
    * report: it moves `project.health`, which is what the chip on the project
    * list reads. A comment deliberately does not — it posts as `no-update`.
    */
   const handlePost = async () => {
      const body = text.trim();
      if (body === '' || !ablo || !project) return;
      const posted: ProjectUpdateHealth = mode === 'update' ? health : 'no-update';
      setPending(true);
      try {
         await ablo.projectUpdate.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               teamId: project.teamId,
               projectId,
               authorId: viewerId,
               health: posted,
               body: JSON.stringify(
                  body
                     .split(/\n{2,}/)
                     .map((paragraph) => paragraph.trim())
                     .filter((paragraph) => paragraph !== '')
                     .map((paragraph) => ({ type: 'paragraph', text: paragraph }))
               ),
            },
         });
         if (mode === 'update') {
            await ablo.project.update({
               id: projectId,
               data: { health: posted, healthUpdatedAt: new Date() },
            });
         }
         setText('');
      } catch (error) {
         toast.error(`Could not post the ${mode}`, {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   };

   return (
      <div className="w-full h-full flex overflow-hidden">
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 lg:px-10 py-8">
               {/* Composer */}
               <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2">
                     <div className="flex items-center rounded-md border p-0.5 text-xs">
                        {(['comment', 'update'] as const).map((value) => (
                           <button
                              key={value}
                              type="button"
                              onClick={() => setMode(value)}
                              className={cn(
                                 'px-2 py-1 rounded-[5px] capitalize transition-colors',
                                 mode === value
                                    ? 'bg-accent text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                              )}
                           >
                              {value}
                           </button>
                        ))}
                     </div>
                     {mode === 'update' && (
                        <DropdownMenu>
                           <DropdownMenuTrigger className="outline-none">
                              <HealthBadge health={health} />
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="start" className="w-40">
                              {postableHealth.map((value) => (
                                 <DropdownMenuItem key={value} onClick={() => setHealth(value)}>
                                    <span
                                       className="size-2 rounded-full"
                                       style={{ backgroundColor: projectUpdateHealthColor[value] }}
                                    />
                                    {projectUpdateHealthLabel[value]}
                                 </DropdownMenuItem>
                              ))}
                           </DropdownMenuContent>
                        </DropdownMenu>
                     )}
                  </div>

                  <textarea
                     value={text}
                     onChange={(event) => setText(event.target.value)}
                     placeholder={
                        mode === 'update' ? 'Write a project update…' : 'Leave a comment…'
                     }
                     className="mt-3 w-full min-h-24 resize-y bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />

                  {mode === 'update' && (
                     <div className="mt-1 border-l-2 pl-4 py-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <div className="flex gap-6">
                           <span className="w-20">Priority</span>
                           <span>
                              No priority →{' '}
                              <span className="text-foreground">{project.priority.name}</span>
                           </span>
                        </div>
                        <div className="flex gap-6">
                           <span className="w-20">Lead</span>
                           <span>
                              <span className="text-foreground">{project.lead.name}</span> assigned
                           </span>
                        </div>
                        <div className="flex gap-6">
                           <span className="w-20">Target date</span>
                           <span>
                              set to{' '}
                              <span className="text-foreground">
                                 {project.targetDate
                                    ? format(parseISO(project.targetDate), 'MMM do')
                                    : '—'}
                              </span>
                           </span>
                        </div>
                        <div className="flex gap-6">
                           <span className="w-20">Progress</span>
                           <span>
                              0% → <span className="text-foreground">{completedPercent}%</span>
                           </span>
                        </div>
                     </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                     <Unavailable reason="Drafting an update with the agent is not built">
                        <Button variant="outline" size="xs" className="gap-1.5" disabled>
                           <Sparkles className="size-3.5" />
                           Write with Agent
                        </Button>
                     </Unavailable>
                     <div className="flex items-center gap-2">
                        <Button
                           variant="ghost"
                           size="icon"
                           className="size-7 text-muted-foreground"
                        >
                           <Paperclip className="size-4" />
                        </Button>
                        <Button
                           size="xs"
                           onClick={() => void handlePost()}
                           disabled={pending || text.trim() === ''}
                        >
                           {pending
                              ? 'Posting…'
                              : `Post ${mode === 'update' ? 'update' : 'comment'}`}
                        </Button>
                     </div>
                  </div>
               </div>

               {/* Timeline */}
               {updatesByMonth.length === 0 ? (
                  <p className="mt-10 text-sm text-muted-foreground text-center">
                     No updates yet — post the first one to keep the team in the loop.
                  </p>
               ) : (
                  updatesByMonth.map(([month, monthUpdates]) => (
                     <div key={month} className="mt-8">
                        <h3 className="text-lg font-semibold mb-3">{month}</h3>
                        <div className="flex flex-col gap-3">
                           {monthUpdates.map((update) => (
                              <UpdateCard key={update.id} update={update} />
                           ))}
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>

         <ProjectSidePanel project={project} issues={issues} />
      </div>
   );
}
