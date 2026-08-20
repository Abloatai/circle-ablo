'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import { useViewActions } from '@/hooks/use-view-actions';
import { useLabels, useStatuses } from '@/hooks/use-workspace-data';
import { priorities } from '@/lib/domain/priorities';
import type { ViewFilter, ViewType } from '@/lib/domain/views';

const CATEGORIES = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'] as const;

/**
 * Saves a view.
 *
 * The filter is the same declarative shape `filterIssuesForView` already
 * applies, so a view saved here is read by exactly the code that reads a seeded
 * one — there is no second filter language.
 */
export function CreateView({ teamId }: { teamId?: string }) {
   const { orgId } = useParams<{ orgId: string }>();
   const router = useRouter();
   const { create } = useViewActions();
   const statuses = useStatuses();
   const labels = useLabels();

   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [icon, setIcon] = useState('🔍');
   const [description, setDescription] = useState('');
   const [type, setType] = useState<ViewType>('issue');
   const [category, setCategory] = useState<string>('any');
   const [priorityId, setPriorityId] = useState<string>('any');
   const [labelId, setLabelId] = useState<string>('any');
   const [unassigned, setUnassigned] = useState(false);
   const [pending, setPending] = useState(false);

   async function submit(event: React.FormEvent) {
      event.preventDefault();
      setPending(true);

      const filter: ViewFilter = {
         ...(category !== 'any'
            ? { statusCategories: [category as (typeof CATEGORIES)[number]] }
            : {}),
         ...(priorityId !== 'any' ? { priorityIds: [priorityId] } : {}),
         ...(labelId !== 'any' ? { labelIds: [labelId] } : {}),
         ...(unassigned ? { unassigned: true } : {}),
      };

      const id = await create({ name, description, icon, type, teamId, filter });
      setPending(false);
      if (!id) return;
      setName('');
      setDescription('');
      setOpen(false);
      router.push(`/${orgId}/view/${id}`);
   }

   const categoriesInUse = CATEGORIES.filter((entry) =>
      statuses.some((status) => status.category === entry)
   );

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button size="xs" variant="ghost" aria-label="New view">
               <Plus className="size-3.5" />
            </Button>
         </DialogTrigger>
         <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
               <DialogTitle>New view</DialogTitle>
               <DialogDescription>
                  A saved filter.{' '}
                  {teamId ? 'This team can see it.' : 'The whole workspace can see it.'}
               </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-4">
               <div className="flex gap-2">
                  <div className="w-16 space-y-1.5">
                     <Label htmlFor="view-icon">Icon</Label>
                     <Input
                        id="view-icon"
                        value={icon}
                        onChange={(event) => setIcon(event.target.value)}
                        className="text-center"
                        maxLength={4}
                     />
                  </div>
                  <div className="flex-1 space-y-1.5">
                     <Label htmlFor="view-name">Name</Label>
                     <Input
                        id="view-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Blocked for 3 days"
                        autoFocus
                     />
                  </div>
               </div>

               <div className="space-y-1.5">
                  <Label htmlFor="view-description">Description</Label>
                  <Input
                     id="view-description"
                     value={description}
                     onChange={(event) => setDescription(event.target.value)}
                     placeholder="What this view is for"
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label>Shows</Label>
                     <Select value={type} onValueChange={(value) => setType(value as ViewType)}>
                        <SelectTrigger className="w-full">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="issue">Issues</SelectItem>
                           <SelectItem value="project">Projects</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5">
                     <Label>Status</Label>
                     <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="w-full">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="any">Any status</SelectItem>
                           {categoriesInUse.map((entry) => (
                              <SelectItem key={entry} value={entry} className="capitalize">
                                 {entry}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               {type === 'issue' && (
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                        <Label>Priority</Label>
                        <Select value={priorityId} onValueChange={setPriorityId}>
                           <SelectTrigger className="w-full">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="any">Any priority</SelectItem>
                              {priorities.map((priority) => (
                                 <SelectItem key={priority.id} value={priority.id}>
                                    {priority.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="space-y-1.5">
                        <Label>Label</Label>
                        <Select value={labelId} onValueChange={setLabelId}>
                           <SelectTrigger className="w-full">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="any">Any label</SelectItem>
                              {labels.map((label) => (
                                 <SelectItem key={label.id} value={label.id}>
                                    {label.name}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>
               )}

               {type === 'issue' && (
                  <label className="flex items-center gap-2 text-sm">
                     <input
                        type="checkbox"
                        checked={unassigned}
                        onChange={(event) => setUnassigned(event.target.checked)}
                     />
                     Only unassigned issues
                  </label>
               )}

               <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                     Cancel
                  </Button>
                  <Button type="submit" disabled={pending || !name.trim()}>
                     {pending ? 'Saving…' : 'Save view'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
