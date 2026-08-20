'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { cn } from '@/lib/utils';

/**
 * Colors are stored as CSS keywords, which is what the label badges already
 * render, so the palette here is the set the seeded labels use rather than a
 * free-form picker producing values nothing knows how to draw.
 */
const COLORS = [
   'purple',
   'red',
   'green',
   'blue',
   'yellow',
   'orange',
   'pink',
   'gray',
   'indigo',
   'teal',
   'cyan',
] as const;

/** Creates a workspace label. Labels are org-scoped, so every team sees them. */
export function CreateLabel() {
   const ablo = useAblo();
   const { organizationId } = useWorkspace();
   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [color, setColor] = useState<string>(COLORS[0]);
   const [pending, setPending] = useState(false);

   async function create(event: React.FormEvent) {
      event.preventDefault();
      if (!ablo) return;
      setPending(true);
      try {
         await ablo.label.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               name: name.trim(),
               color,
            },
         });
         toast.success(`Created ${name.trim()}`);
         setName('');
         setOpen(false);
      } catch (error) {
         toast.error('Could not create the label', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   }

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button size="xs">New label</Button>
         </DialogTrigger>
         <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
               <DialogTitle>New label</DialogTitle>
               <DialogDescription>Labels are shared across the whole workspace.</DialogDescription>
            </DialogHeader>

            <form onSubmit={create} className="space-y-4">
               <div className="space-y-1.5">
                  <Label htmlFor="label-name">Name</Label>
                  <Input
                     id="label-name"
                     required
                     autoFocus
                     placeholder="Regression"
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                  />
               </div>

               <div className="space-y-1.5">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-1.5">
                     {COLORS.map((candidate) => (
                        <button
                           key={candidate}
                           type="button"
                           aria-label={candidate}
                           aria-pressed={color === candidate}
                           onClick={() => setColor(candidate)}
                           style={{ backgroundColor: candidate }}
                           className={cn(
                              'size-6 rounded-full border transition',
                              color === candidate
                                 ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground'
                                 : 'opacity-70 hover:opacity-100'
                           )}
                        />
                     ))}
                  </div>
               </div>

               <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={pending || !name.trim()}>
                     {pending ? 'Creating…' : 'Create label'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
