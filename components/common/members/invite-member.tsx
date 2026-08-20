'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
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
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Invites someone into the workspace.
 *
 * The team is chosen here rather than left for later because an issue belongs
 * to a team: a member of the workspace who is on no team can see nothing.
 */
export function InviteMember() {
   const { teams, myTeamIds } = useWorkspace();
   const myTeams = teams.filter((team) => myTeamIds.has(team.id));

   const [open, setOpen] = useState(false);
   const [email, setEmail] = useState('');
   const [role, setRole] = useState<'member' | 'admin'>('member');
   const [teamId, setTeamId] = useState<string>(myTeams[0]?.id ?? '');
   const [pending, setPending] = useState(false);

   async function invite(event: React.FormEvent) {
      event.preventDefault();
      setPending(true);
      try {
         const response = await fetch('/api/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role, teamId: teamId || undefined }),
         });
         const result = (await response.json()) as { error?: string; email?: string };
         if (!response.ok) throw new Error(result.error ?? 'Could not send the invitation');

         toast.success(`Invitation sent to ${result.email}`);
         setEmail('');
         setOpen(false);
      } catch (error) {
         toast.error('Could not send the invitation', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   }

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
               <UserPlus className="size-4" />
               Invite
            </Button>
         </DialogTrigger>
         <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
               <DialogTitle>Invite to the workspace</DialogTitle>
               <DialogDescription>They will get an email with a link to join.</DialogDescription>
            </DialogHeader>

            <form onSubmit={invite} className="space-y-4">
               <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                     id="invite-email"
                     type="email"
                     required
                     autoFocus
                     placeholder="teammate@example.com"
                     value={email}
                     onChange={(event) => setEmail(event.target.value)}
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label htmlFor="invite-team">Team</Label>
                     <Select value={teamId} onValueChange={setTeamId}>
                        <SelectTrigger id="invite-team">
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
                     <Label htmlFor="invite-role">Role</Label>
                     <Select
                        value={role}
                        onValueChange={(value) => setRole(value as 'member' | 'admin')}
                     >
                        <SelectTrigger id="invite-role">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="member">Member</SelectItem>
                           <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={pending || !email.trim()}>
                     {pending ? 'Sending…' : 'Send invitation'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
