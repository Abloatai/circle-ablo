'use client';

import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import { useLabelActions } from '@/hooks/use-label-actions';
import type { LabelInterface } from '@/lib/domain/labels';

const NONE = '__none__';

/** Moves a label into a group, or out of every group. */
export function GroupSelect({
   label,
   groups,
}: {
   label: LabelInterface;
   groups: LabelInterface[];
}) {
   const { setGroup } = useLabelActions();

   return (
      <Select
         value={label.parentId ?? NONE}
         onValueChange={(next) => void setGroup(label.id, next === NONE ? null : next)}
      >
         <SelectTrigger className="h-7 w-[150px] text-xs" aria-label={`Group of ${label.name}`}>
            <SelectValue placeholder="No group" />
         </SelectTrigger>
         <SelectContent>
            <SelectItem value={NONE}>No group</SelectItem>
            {groups.map((group) => (
               <SelectItem key={group.id} value={group.id}>
                  {group.name}
               </SelectItem>
            ))}
         </SelectContent>
      </Select>
   );
}
