'use client';

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
import { useMembershipActions } from '@/hooks/use-membership-actions';

/**
 * Confirms leaving a team.
 *
 * Recoverable — someone with permission can add you back — so this asks once
 * and says what changes, rather than demanding you type the name.
 */
export function LeaveTeamDialog({
   teamId,
   teamName,
   open,
   onOpenChange,
}: {
   teamId: string;
   teamName: string;
   open: boolean;
   onOpenChange: (open: boolean) => void;
}) {
   const { leaveTeam, pending } = useMembershipActions();

   return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>Leave {teamName}?</AlertDialogTitle>
               <AlertDialogDescription>
                  You will stop seeing this team&rsquo;s issues, cycles and documents, and it will
                  disappear from your sidebar. Issues assigned to you stay assigned. Someone with
                  permission can add you back.
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
               <AlertDialogAction
                  onClick={(event) => {
                     event.preventDefault();
                     void leaveTeam(teamId, teamName);
                  }}
                  disabled={pending}
               >
                  {pending ? 'Leaving…' : 'Leave team'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}

/**
 * Confirms leaving the workspace.
 *
 * Heavier than leaving a team: it removes every team at once and you need a new
 * invitation to return. Better Auth refuses if you are the only owner, and that
 * refusal is surfaced as a toast rather than swallowed.
 */
export function LeaveWorkspaceDialog({
   workspaceName,
   open,
   onOpenChange,
}: {
   workspaceName: string;
   open: boolean;
   onOpenChange: (open: boolean) => void;
}) {
   const { leaveWorkspace, pending } = useMembershipActions();

   return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>Leave {workspaceName}?</AlertDialogTitle>
               <AlertDialogDescription>
                  You will lose access to every team, issue and document in this workspace. Nothing
                  is deleted — your issues and comments stay where they are — but you will need a
                  new invitation to come back.
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
               <AlertDialogAction
                  onClick={(event) => {
                     event.preventDefault();
                     void leaveWorkspace();
                  }}
                  disabled={pending}
               >
                  {pending ? 'Leaving…' : 'Leave workspace'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
