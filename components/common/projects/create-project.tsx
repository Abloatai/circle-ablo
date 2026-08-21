'use client';

import { useEffect, useState } from 'react';
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
import { useTeamStatuses } from '@/hooks/use-workspace-data';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Creates a project.
 *
 * The team is picked here and limited to the viewer's own, because a project
 * fans out on its team's sync group: filing one against a team you are not in
 * would write a row you then cannot see.
 */
export function CreateProject() {
   const ablo = useAblo();
   const router = useRouter();
   const { orgId } = useParams<{ orgId: string }>();
   const { teams, myTeamIds, viewerId, organizationId } = useWorkspace();
   const myTeams = teams.filter((team) => myTeamIds.has(team.id));
   const [teamId, setTeamId] = useState(myTeams[0]?.id ?? '');
   const statuses = useTeamStatuses(teamId);

   // A new project starts in the earliest non-started state, the way a new
   // issue does, rather than in whichever status happens to sort first.
   const defaultStatus =
      statuses.find((status) => status.category === 'backlog') ??
      statuses.find((status) => status.category === 'unstarted') ??
      statuses[0];

   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [statusId, setStatusId] = useState(defaultStatus?.id ?? '');
   const [leadId, setLeadId] = useState(viewerId);
   const [targetDate, setTargetDate] = useState('');
   const [pending, setPending] = useState(false);

   const { members } = useWorkspace();
   const teamMembers = members.filter((member) => member.teamIds.includes(teamId));

   useEffect(() => {
      if (!statuses.some((status) => status.id === statusId)) {
         setStatusId(defaultStatus?.id ?? '');
      }
   }, [defaultStatus?.id, statuses, statusId]);

   async function create(event: React.FormEvent) {
      event.preventDefault();
      if (!ablo) return;
      setPending(true);
      try {
         const created = await ablo.project.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               teamId,
               name: name.trim(),
               statusId: statusId || defaultStatus?.id,
               percentComplete: 0,
               priority: 0,
               health: 'no-update',
               leadId,
               ...(targetDate ? { targetDate } : {}),
            },
         });

         toast.success(`Created ${name.trim()}`);
         setName('');
         setTargetDate('');
         setOpen(false);
         // Ablo assigns its own id, so the row it returns is the one to open.
         router.push(`/${orgId}/project/${created.id}/overview`);
      } catch (error) {
         toast.error('Could not create the project', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   }

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button className="relative" size="xs" variant="secondary">
               <Plus className="size-4" />
               <span className="hidden sm:inline ml-1">Create project</span>
            </Button>
         </DialogTrigger>
         <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
               <DialogTitle>New project</DialogTitle>
               <DialogDescription>
                  Projects group issues across a stretch of work.
               </DialogDescription>
            </DialogHeader>

            <form onSubmit={create} className="space-y-4">
               <div className="space-y-1.5">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                     id="project-name"
                     required
                     autoFocus
                     placeholder="Onboarding revamp"
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label htmlFor="project-team">Team</Label>
                     <Select value={teamId} onValueChange={setTeamId}>
                        <SelectTrigger id="project-team">
                           <SelectValue placeholder="Pick a team" />
                        </SelectTrigger>
                        <SelectContent>
                           {myTeams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                 {team.icon} {team.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5">
                     <Label htmlFor="project-status">Status</Label>
                     <Select value={statusId} onValueChange={setStatusId}>
                        <SelectTrigger id="project-status">
                           <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                           {statuses.map((status) => (
                              <SelectItem key={status.id} value={status.id}>
                                 {status.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5">
                     <Label htmlFor="project-lead">Lead</Label>
                     <Select value={leadId} onValueChange={setLeadId}>
                        <SelectTrigger id="project-lead">
                           <SelectValue placeholder="Lead" />
                        </SelectTrigger>
                        <SelectContent>
                           {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                 {member.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="space-y-1.5">
                     <Label htmlFor="project-target">Target date</Label>
                     <Input
                        id="project-target"
                        type="date"
                        value={targetDate}
                        onChange={(event) => setTargetDate(event.target.value)}
                     />
                  </div>
               </div>

               <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={pending || !name.trim() || !teamId}>
                     {pending ? 'Creating…' : 'Create project'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
