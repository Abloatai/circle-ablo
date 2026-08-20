'use client';

import { Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useAblo } from '@/lib/ablo';

/**
 * Shows that someone is currently holding this issue.
 *
 * A claim is how a slow writer — a person mid-edit, or an agent that reads now
 * and writes thirty seconds later — announces it is working on a row. Reading
 * the state costs nothing and never blocks, so this can sit on every line.
 */
export function IssueActivityIndicator({ issueId }: { issueId: string }) {
   const claim = useAblo((ablo) => ablo.issue.claim.state({ id: issueId }));
   const { membersById } = useWorkspace();

   if (!claim) return null;

   const holderId =
      (claim as { userId?: string; agentId?: string }).userId ??
      (claim as { agentId?: string }).agentId;
   const holder = holderId ? membersById.get(holderId) : undefined;
   const description = (claim as { description?: string }).description;

   const who = holder ? holder.name : 'Someone';
   const label = description ? `${who} — ${description}` : `${who} is working on this`;

   return (
      <Tooltip>
         <TooltipTrigger asChild>
            <span className="flex items-center gap-1 text-[10px] text-amber-500" aria-label={label}>
               <Loader2 className="size-3 animate-spin" />
            </span>
         </TooltipTrigger>
         <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
   );
}
