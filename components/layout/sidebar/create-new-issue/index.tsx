import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Heart } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Issue } from '@/lib/domain/issues';
import { priorities } from '@/lib/domain/priorities';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useIssues, useTeamStatuses } from '@/hooks/use-workspace-data';
import { levelFromPriority } from '@/lib/data/hydrate';
import { useCreateIssueStore } from '@/store/create-issue-store';
import { toast } from 'sonner';
import { StatusSelector } from './status-selector';
import { PrioritySelector } from './priority-selector';
import { AssigneeSelector } from './assignee-selector';
import { ProjectSelector } from './project-selector';
import { LabelSelector } from './label-selector';
import { DialogTitle } from '@radix-ui/react-dialog';
import { CycleSelector } from '@/components/common/issues/cycle-selector';

/**
 * The "new issue" dialog. Mounted exactly once, by `CreateIssueModalProvider`,
 * and opened through `useCreateIssueStore` from the sidebar button, the command
 * palette or a board column header.
 *
 * It owns no trigger of its own on purpose. It used to, and was mounted twice —
 * once for the sidebar button and once by the provider inside a `hidden` div —
 * but `DialogContent` portals to `document.body`, so `hidden` never contained
 * it. Opening the store rendered both dialogs stacked, the upper one
 * `aria-hidden` and swallowing pointer events aimed at the lower.
 */
export function CreateNewIssue() {
   const [createMore, setCreateMore] = useState<boolean>(false);
   const [saving, setSaving] = useState(false);
   const { isOpen, defaultStatus, defaultCycleId, parentIssueId, openModal, closeModal } =
      useCreateIssueStore();
   const { teamByKey, teams } = useWorkspace();
   const allIssues = useIssues();
   const parent = parentIssueId ? allIssues.find((issue) => issue.id === parentIssueId) : undefined;
   const params = useParams<{ teamId?: string }>();

   // A sub-issue lives on its parent's team; otherwise the team you are looking
   // at, falling back to the first you belong to.
   const parentTeam = parent?.teamId
      ? teams.find((candidate) => candidate.id === parent.teamId)
      : undefined;
   const routeTeam = params?.teamId
      ? (teamByKey.get(params.teamId) ?? teams.find((candidate) => candidate.id === params.teamId))
      : undefined;
   const team = parentTeam ?? routeTeam ?? (params?.teamId ? undefined : teams[0]);
   const statuses = useTeamStatuses(team?.id);

   const createDefaultData = useCallback(() => {
      return {
         id: '',
         // Allocated by the server on save: it has to be unique per workspace.
         identifier: '',
         title: '',
         description: '',
         status: defaultStatus || statuses.find((s) => s.category === 'unstarted') || statuses[0],
         assignee: null,
         priority: priorities.find((p) => p.id === 'no-priority')!,
         labels: [],
         createdAt: new Date().toISOString(),
         cycleId: defaultCycleId ?? '',
         project: undefined,
         subissues: [],
         rank: `z${Date.now().toString(36)}`,
      };
   }, [defaultCycleId, defaultStatus, statuses]);

   const [addIssueForm, setAddIssueForm] = useState<Issue>(createDefaultData);

   // Read through a ref so the reset below can depend on the dialog opening
   // rather than on the identity of the synced status list.
   const latestDefaults = useRef(createDefaultData);
   latestDefaults.current = createDefaultData;

   /**
    * Fresh defaults each time the dialog opens — and only then.
    *
    * This used to key on `createDefaultData`, which changes identity whenever
    * `statuses` does, and `statuses` is a live read off the synced pool: any
    * delta arriving for a workflow state produced a new array, a new callback,
    * and a form reset. Two consequences, one visible and one not. A teammate
    * touching a workflow state wiped whatever you had typed. And because the
    * defaults embed `new Date()` and a `Date.now()` rank, every reset wrote a
    * genuinely new object, re-rendered, and set up the next one — the page
    * logged `Maximum update depth exceeded` by the dozen.
    */
   useEffect(() => {
      if (isOpen) setAddIssueForm(latestDefaults.current());
   }, [isOpen]);

   const createIssue = async () => {
      if (!addIssueForm.title) {
         toast.error('Title is required');
         return;
      }
      if (!team) {
         toast.error('You are not on a team yet');
         return;
      }

      setSaving(true);
      try {
         const response = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               teamId: team.id,
               title: addIssueForm.title,
               description: addIssueForm.description,
               statusId: addIssueForm.status?.id,
               assigneeId: addIssueForm.assignee?.id ?? null,
               priority: levelFromPriority(addIssueForm.priority.id),
               projectId: addIssueForm.project?.id ?? null,
               cycleId: addIssueForm.cycleId || null,
               parentIssueId,
               labelIds: addIssueForm.labels.map((label) => label.id),
               rank: addIssueForm.rank,
            }),
         });
         if (!response.ok) throw new Error((await response.json()).error ?? 'Could not create');
         const { identifier } = (await response.json()) as { identifier: string };
         toast.success(`${identifier} created`);
         if (!createMore) closeModal();
         setAddIssueForm(createDefaultData());
      } catch (error) {
         toast.error('Could not create the issue', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setSaving(false);
      }
   };

   return (
      <Dialog open={isOpen} onOpenChange={(value) => (value ? openModal() : closeModal())}>
         <DialogContent className="w-full sm:max-w-[750px] p-0 shadow-xl top-[30%]">
            <DialogHeader>
               <DialogTitle>
                  <div className="flex items-center px-4 pt-4 gap-2">
                     <Button size="sm" variant="outline" className="gap-1.5">
                        <Heart className="size-4 text-orange-500 fill-orange-500" />
                        <span className="font-medium">{team?.key ?? '—'}</span>
                     </Button>
                     {parent && (
                        <span className="text-sm font-normal text-muted-foreground">
                           New sub-issue of{' '}
                           <span className="text-foreground font-medium">{parent.identifier}</span>
                        </span>
                     )}
                  </div>
               </DialogTitle>
            </DialogHeader>

            <div className="px-4 pb-0 space-y-3 w-full">
               <Input
                  className="border-none w-full shadow-none outline-none text-2xl font-medium px-0 h-auto focus-visible:ring-0 overflow-hidden text-ellipsis whitespace-normal break-words"
                  placeholder="Issue title"
                  value={addIssueForm.title}
                  onChange={(e) => setAddIssueForm({ ...addIssueForm, title: e.target.value })}
               />

               <Textarea
                  className="border-none w-full shadow-none outline-none resize-none px-0 min-h-16 focus-visible:ring-0 break-words whitespace-normal overflow-wrap"
                  placeholder="Add description..."
                  value={addIssueForm.description}
                  onChange={(e) =>
                     setAddIssueForm({ ...addIssueForm, description: e.target.value })
                  }
               />

               <div className="w-full flex items-center justify-start gap-1.5 flex-wrap">
                  <StatusSelector
                     status={addIssueForm.status}
                     teamId={team?.id}
                     onChange={(newStatus) =>
                        setAddIssueForm({ ...addIssueForm, status: newStatus })
                     }
                  />
                  <PrioritySelector
                     priority={addIssueForm.priority}
                     onChange={(newPriority) =>
                        setAddIssueForm({ ...addIssueForm, priority: newPriority })
                     }
                  />
                  <AssigneeSelector
                     assignee={addIssueForm.assignee}
                     teamId={team?.id}
                     onChange={(newAssignee) =>
                        setAddIssueForm({ ...addIssueForm, assignee: newAssignee })
                     }
                  />
                  <ProjectSelector
                     project={addIssueForm.project}
                     teamId={team?.id}
                     onChange={(newProject) =>
                        setAddIssueForm({ ...addIssueForm, project: newProject })
                     }
                  />
                  <LabelSelector
                     selectedLabels={addIssueForm.labels}
                     onChange={(newLabels) =>
                        setAddIssueForm({ ...addIssueForm, labels: newLabels })
                     }
                  />
                  <CycleSelector
                     cycleId={addIssueForm.cycleId}
                     teamId={team?.id}
                     compact
                     onChange={(cycleId) => setAddIssueForm({ ...addIssueForm, cycleId })}
                  />
               </div>
            </div>
            <div className="flex items-center justify-between py-2.5 px-4 w-full border-t">
               <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                     <Switch
                        id="create-more"
                        checked={createMore}
                        onCheckedChange={setCreateMore}
                     />
                     <Label htmlFor="create-more">Create more</Label>
                  </div>
               </div>
               <Button size="sm" disabled={saving} onClick={() => void createIssue()}>
                  {saving ? 'Creating…' : 'Create issue'}
               </Button>
            </div>
         </DialogContent>
      </Dialog>
   );
}
