'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { useTeamAdminActions } from '@/hooks/use-team-admin-actions';

/** Confirms retiring a team, or bringing a retired one back. */
export function RetireTeamDialog({
   teamId,
   teamName,
   archived,
   open,
   onOpenChange,
}: {
   teamId: string;
   teamName: string;
   archived: boolean;
   open: boolean;
   onOpenChange: (open: boolean) => void;
}) {
   const { setArchived, pending } = useTeamAdminActions();

   return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>
                  {archived ? `Bring ${teamName} back?` : `Retire ${teamName}?`}
               </AlertDialogTitle>
               <AlertDialogDescription>
                  {archived
                     ? 'The team becomes active again and can take new issues.'
                     : 'Everything the team has stays exactly where it is and stays readable. It just stops taking new issues. You can bring it back at any time.'}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
               <AlertDialogAction
                  onClick={(event) => {
                     event.preventDefault();
                     void setArchived(teamId, teamName, !archived);
                  }}
                  disabled={pending}
               >
                  {pending ? 'Saving…' : archived ? 'Bring back' : 'Retire team'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}

/**
 * Confirms deleting a team.
 *
 * The only irreversible action in the app, and it takes a lot with it, so it
 * names the counts and asks for the team's name to be typed. The counts are
 * read live from the synced pool by the caller rather than guessed.
 */
export function DeleteTeamDialog({
   teamId,
   teamName,
   counts,
   open,
   onOpenChange,
}: {
   teamId: string;
   teamName: string;
   counts: { issues: number; cycles: number; projects: number; documents: number };
   open: boolean;
   onOpenChange: (open: boolean) => void;
}) {
   const { remove, pending } = useTeamAdminActions();
   const [typed, setTyped] = useState('');

   const parts = [
      [counts.issues, 'issue'],
      [counts.cycles, 'cycle'],
      [counts.projects, 'project'],
      [counts.documents, 'document'],
   ] as const;
   const summary = parts
      .filter(([n]) => n > 0)
      .map(([n, noun]) => `${n} ${noun}${n === 1 ? '' : 's'}`)
      .join(', ');

   return (
      <AlertDialog
         open={open}
         onOpenChange={(next) => {
            if (!next) setTyped('');
            onOpenChange(next);
         }}
      >
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>Delete {teamName}?</AlertDialogTitle>
               <AlertDialogDescription>
                  {summary
                     ? `This deletes the team and everything in it — ${summary}, and their comments and history. `
                     : 'This deletes the team. It has nothing in it. '}
                  There is no undo and no restoration window. If you only want to stop new work
                  going into it, retire it instead.
               </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
               <p className="text-sm text-muted-foreground">
                  Type <span className="font-medium text-foreground">{teamName}</span> to confirm.
               </p>
               <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={teamName}
                  autoComplete="off"
               />
            </div>
            <AlertDialogFooter>
               <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
               <AlertDialogAction
                  onClick={(event) => {
                     event.preventDefault();
                     void remove(teamId, teamName, typed);
                  }}
                  disabled={pending || typed.trim() !== teamName}
               >
                  {pending ? 'Deleting…' : 'Delete team'}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
