'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useIssueActions } from '@/hooks/use-issue-actions';
import { useAblo } from '@/lib/ablo';
import { notify } from '@/lib/data/notify';
import { toast } from 'sonner';
import type { Member } from '@/lib/data/members';
import { statusUserColors, User } from '@/lib/domain/users';
import { Bot, CheckIcon, CircleUserRound, Send, UserIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AssigneeUserProps {
   user: User | null;
   /** The issue to reassign. Omitted where the control is read-only. */
   issueId?: string;
   /** Restricts the list to one team's members. */
   teamId?: string;
}

export function AssigneeUser({ user, issueId, teamId }: AssigneeUserProps) {
   const [open, setOpen] = useState(false);
   const [currentAssignee, setCurrentAssignee] = useState<User | null>(user);
   const { members, viewerId, organizationId } = useWorkspace();
   const { setAssignee } = useIssueActions();
   const ablo = useAblo();

   useEffect(() => {
      setCurrentAssignee(user);
   }, [user]);

   const assignable = teamId ? members.filter((m) => m.teamIds.includes(teamId)) : members;

   const assign = (next: Member | null) => {
      // Optimistic locally; the write below is what everyone else sees.
      setCurrentAssignee(next);
      setOpen(false);
      if (!issueId) return;
      void setAssignee(issueId, next?.id ?? null);
      void notify({
         ablo,
         workspaceId: organizationId,
         actorId: viewerId,
         issueId,
         type: 'assignment',
         recipients: [next?.id],
      });

      // Handing work to an agent is an ordinary assignment plus a run: the
      // agent picks the issue up the way a person would notice it in their queue.
      if (next?.type === 'agent') void startAgentRun(issueId, next);
   };

   async function startAgentRun(issue: string, agent: Member) {
      try {
         const response = await fetch('/api/agent/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issueId: issue, agentUserId: agent.id }),
         });
         if (!response.ok) throw new Error(await response.text());
         toast.success(`${agent.name} picked it up`, {
            description: 'Follow along in the issue’s activity.',
         });
      } catch {
         toast.error(`${agent.name} could not start`, {
            description: 'The issue is still assigned; try again from the issue view.',
         });
      }
   }

   const renderAvatar = () => {
      if (currentAssignee) {
         return (
            <Avatar className="size-6 shrink-0">
               <AvatarImage src={currentAssignee.avatarUrl} alt={currentAssignee.name} />
               <AvatarFallback>{currentAssignee.name[0]}</AvatarFallback>
            </Avatar>
         );
      } else {
         return (
            <div className="size-6 flex items-center justify-center">
               <CircleUserRound className="size-5 text-zinc-600" />
            </div>
         );
      }
   };

   return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
         <DropdownMenuTrigger asChild>
            <button className="relative w-fit focus:outline-none">
               {renderAvatar()}
               {currentAssignee && (
                  <span
                     className="border-background absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2"
                     style={{ backgroundColor: statusUserColors[currentAssignee.status] }}
                  >
                     <span className="sr-only">{currentAssignee.status}</span>
                  </span>
               )}
            </button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="start" className="w-[206px]">
            <DropdownMenuLabel>Assign to...</DropdownMenuLabel>
            <DropdownMenuItem
               onClick={(e) => {
                  e.stopPropagation();
                  assign(null);
               }}
            >
               <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  <span>No assignee</span>
               </div>
               {!currentAssignee && <CheckIcon className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {assignable.map((member) => (
               <DropdownMenuItem
                  key={member.id}
                  onClick={(e) => {
                     e.stopPropagation();
                     assign(member);
                  }}
               >
                  <div className="flex items-center gap-2">
                     <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                     </Avatar>
                     <span>{member.name}</span>
                     {member.type === 'agent' && (
                        <Bot className="size-3.5 text-muted-foreground" aria-label="Agent" />
                     )}
                  </div>
                  {currentAssignee?.id === member.id && <CheckIcon className="ml-auto h-4 w-4" />}
               </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>New user</DropdownMenuLabel>
            <DropdownMenuItem>
               <div className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  <span>Invite and assign...</span>
               </div>
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
