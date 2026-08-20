'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { addDays, format } from 'date-fns';
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
import { useAblo } from '@/lib/ablo';
import { useCycles } from '@/hooks/use-workspace-data';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Creates a cycle for the team whose page this is.
 *
 * The number is the team's next one, taken from the cycles already on screen.
 * Two people creating a cycle in the same second would collide on it — unlike
 * an issue identifier, which is handed out by a counter server-side. Cycles are
 * made rarely and deliberately enough that a shared counter is not worth the
 * round trip; the number is a label here, not an identity.
 */
export function CreateCycle() {
   const ablo = useAblo();
   const { teamId } = useParams<{ teamId: string }>();
   const { teams, teamByKey, organizationId } = useWorkspace();
   const cycles = useCycles();

   // The URL carries a team key (CORE), the row carries an id.
   const team = teamByKey.get(teamId) ?? teams.find((candidate) => candidate.id === teamId);

   const teamCycles = cycles.filter((cycle) => cycle.teamId === team?.id);
   const nextNumber = teamCycles.reduce((highest, cycle) => Math.max(highest, cycle.number), 0) + 1;

   const [open, setOpen] = useState(false);
   const [name, setName] = useState('');
   const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
   const [endDate, setEndDate] = useState(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
   const [pending, setPending] = useState(false);

   async function create(event: React.FormEvent) {
      event.preventDefault();
      if (!ablo || !team) return;
      setPending(true);
      try {
         await ablo.cycle.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               teamId: team.id,
               number: nextNumber,
               name: name.trim() || `Cycle ${nextNumber}`,
               status: 'planned',
               startDate,
               endDate,
               capacity: 100,
            },
         });
         toast.success(`Created cycle ${nextNumber}`);
         setName('');
         setOpen(false);
      } catch (error) {
         toast.error('Could not create the cycle', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   }

   if (!team) return null;

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
            <Button size="xs" variant="secondary">
               <Plus className="size-4" />
               <span className="hidden sm:inline ml-1">New cycle</span>
            </Button>
         </DialogTrigger>
         <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
               <DialogTitle>New cycle for {team.name}</DialogTitle>
               <DialogDescription>
                  This will be cycle {nextNumber}. It starts as planned — set it current when the
                  team picks it up.
               </DialogDescription>
            </DialogHeader>

            <form onSubmit={create} className="space-y-4">
               <div className="space-y-1.5">
                  <Label htmlFor="cycle-name">Name</Label>
                  <Input
                     id="cycle-name"
                     autoFocus
                     placeholder={`Cycle ${nextNumber}`}
                     value={name}
                     onChange={(event) => setName(event.target.value)}
                  />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <Label htmlFor="cycle-start">Starts</Label>
                     <Input
                        id="cycle-start"
                        type="date"
                        required
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label htmlFor="cycle-end">Ends</Label>
                     <Input
                        id="cycle-end"
                        type="date"
                        required
                        min={startDate}
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                     />
                  </div>
               </div>

               <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={pending || endDate < startDate}>
                     {pending ? 'Creating…' : 'Create cycle'}
                  </Button>
               </div>
            </form>
         </DialogContent>
      </Dialog>
   );
}
