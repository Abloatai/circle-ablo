'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { INITIATIVE_STATUS_META, type InitiativeStatus } from '@/lib/domain/initiatives';

const STATUSES = Object.keys(INITIATIVE_STATUS_META) as InitiativeStatus[];

/**
 * Creates an initiative.
 *
 * An initiative is workspace-wide rather than team-scoped, so unlike a project
 * there is no team to pick — everyone in the workspace sees it.
 */
export function CreateInitiative() {
   const ablo = useAblo();
   const router = useRouter();
   const { orgId } = useParams<{ orgId: string }>();
   const { members, viewerId, organizationId } = useWorkspace();

   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [icon, setIcon] = useState('🎯');
   const [description, setDescription] = useState('');
   const [status, setStatus] = useState<InitiativeStatus>('planned');
   const [ownerId, setOwnerId] = useState(viewerId);
   const [target, setTarget] = useState('');
   const [pending, setPending] = useState(false);

   async function create(event: React.FormEvent) {
      event.preventDefault();
      if (!ablo) return;
      setPending(true);
      try {
         const created = await ablo.initiative.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               name: name.trim(),
               icon: icon.trim() || '🎯',
               status,
               priority: 0,
               health: 'no-update',
               ownerId,
               ...(description.trim() ? { description: description.trim() } : {}),
               ...(target.trim() ? { target: target.trim() } : {}),
            },
         });

         toast.success(`Created ${name.trim()}`);
         setName('');
         setDescription('');
         setTarget('');
         setOpen(false);
         // Ablo assigns its own id, so the row it returns is the one to open.
         router.push(`/${orgId}/initiative/${created.id}`);
      } catch (error) {
         toast.error('Could not create the initiative', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   }

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button size="xs" variant="ghost" aria-label="New initiative">
               <Plus className="size-4" />
            </Button>
         </DialogTrigger>
         <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
               <DialogTitle>New initiative</DialogTitle>
               <DialogDescription>
                  A goal that spans projects. Everyone in the workspace can see it.
               </DialogDescription>
            </DialogHeader>

            <form onSubmit={create} className="space-y-4">
               <div className="flex gap-2">
                  <div className="w-16 space-y-1.5">
                     <Label htmlFor="initiative-icon">Icon</Label>
                     <Input
                        id="initiative-icon"
                        value={icon}
                        onChange={(event) => setIcon(event.target.value)}
                        className="text-center"
                        maxLength={4}
                     />
                  </div>
                  <div className="flex-1 space-y-1.5">
                     <Label htmlFor="initiative-name">Name</Label>
                     <Input
                        id="initiative-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Ship the component platform"
                        autoFocus
                     />
                  </div>
               </div>

               <div className="space-y-1.5">
                  <Label htmlFor="initiative-description">Description</Label>
                  <Input
                     id="initiative-description"
                     value={description}
                     onChange={(event) => setDescription(event.target.value)}
                     placeholder="What this initiative is for"
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label>Status</Label>
                     <Select
                        value={status}
                        onValueChange={(value) => setStatus(value as InitiativeStatus)}
                     >
                        <SelectTrigger className="w-full">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {STATUSES.map((candidate) => (
                              <SelectItem key={candidate} value={candidate}>
                                 {INITIATIVE_STATUS_META[candidate].label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5">
                     <Label>Owner</Label>
                     <Select value={ownerId} onValueChange={setOwnerId}>
                        <SelectTrigger className="w-full">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {members.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                 {member.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="space-y-1.5">
                  <Label htmlFor="initiative-target">Target</Label>
                  <Input
                     id="initiative-target"
                     value={target}
                     onChange={(event) => setTarget(event.target.value)}
                     placeholder="Q3 2026"
                  />
               </div>

               <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                     Cancel
                  </Button>
                  <Button type="submit" disabled={pending || !name.trim()}>
                     {pending ? 'Creating…' : 'Create initiative'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
