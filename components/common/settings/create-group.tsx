'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLabelActions } from '@/hooks/use-label-actions';

/**
 * Creates a label group.
 *
 * A group is a label row with `isGroup` set. It is never applied to an issue —
 * it exists so the labels inside it become mutually exclusive, the way a status
 * or a priority is.
 */
export function CreateGroup() {
   const { createGroup } = useLabelActions();
   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [pending, setPending] = useState(false);

   async function submit(event: React.FormEvent) {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;
      setPending(true);
      const id = await createGroup(trimmed);
      setPending(false);
      if (!id) return;
      setName('');
      setOpen(false);
   }

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button size="xs" variant="secondary">
               New group
            </Button>
         </DialogTrigger>
         <DialogContent>
            <form onSubmit={submit}>
               <DialogHeader>
                  <DialogTitle>New label group</DialogTitle>
                  <DialogDescription>
                     An issue takes at most one label from a group, the way it has one status.
                     Groups are not applied to issues themselves.
                  </DialogDescription>
               </DialogHeader>
               <div className="space-y-2 py-4">
                  <Label htmlFor="group-name">Name</Label>
                  <Input
                     id="group-name"
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                     placeholder="Priority"
                     autoComplete="off"
                     autoFocus
                  />
               </div>
               <DialogFooter>
                  <Button type="submit" size="sm" disabled={pending || !name.trim()}>
                     {pending ? 'Creating…' : 'Create group'}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
