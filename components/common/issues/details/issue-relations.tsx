'use client';

import { useMemo, useState } from 'react';
import { Ban, Copy, Link2, Plus, X } from 'lucide-react';
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '@/components/ui/select';
import {
   LINK_RELATION_LABEL,
   useIssueLinkActions,
   type LinkRelation,
} from '@/hooks/use-issue-link-actions';
import { useIssues, type IssueLinks, type LinkedIssue } from '@/hooks/use-workspace-data';
import type { HydratedIssue } from '@/lib/data/hydrate';
import { IssueRefRow } from './content-blocks';

const RELATIONS: LinkRelation[] = ['blocked-by', 'blocks', 'related', 'duplicates'];

const ICONS: Record<LinkRelation, React.ReactNode> = {
   'blocked-by': <Ban className="size-3.5 text-red-500 shrink-0" />,
   'blocks': <Ban className="size-3.5 text-amber-500 shrink-0" />,
   'related': <Link2 className="size-3.5 text-muted-foreground shrink-0" />,
   'duplicates': <Copy className="size-3.5 text-muted-foreground shrink-0" />,
};

function LinkRow({
   relation,
   linked,
   onRemove,
}: {
   relation: LinkRelation;
   linked: LinkedIssue;
   onRemove: () => void;
}) {
   return (
      <div className="group flex items-center gap-1.5 min-w-0">
         {ICONS[relation]}
         <IssueRefRow identifier={linked.issue.identifier} />
         <button
            aria-label={`Unlink ${linked.issue.identifier}`}
            onClick={onRemove}
            className="ml-auto shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
         >
            <X className="size-3" />
         </button>
      </div>
   );
}

/**
 * The issues an issue is tied to, and the control that ties them.
 *
 * Read live from `issueLink` — which it always was; what was missing was any
 * way to write one, and the capability to do it. Linking picks a relation and
 * an issue; "blocked by" writes the same `blocks` row from the other end, so
 * both issues agree without a second row that could contradict the first.
 */
export function IssueRelations({ issue, links }: { issue: HydratedIssue; links: IssueLinks }) {
   const allIssues = useIssues();
   const { link, unlink } = useIssueLinkActions();
   const [open, setOpen] = useState(false);
   const [relation, setRelation] = useState<LinkRelation>('blocked-by');

   const groups = useMemo<{ relation: LinkRelation; items: LinkedIssue[] }[]>(
      () => [
         { relation: 'blocked-by', items: links.blockedBy },
         { relation: 'blocks', items: links.blocking },
         { relation: 'related', items: links.related },
         { relation: 'duplicates', items: links.duplicates },
      ],
      [links]
   );

   // An issue cannot be linked to itself, and offering a link that already
   // exists just produces a duplicate row nobody asked for.
   const alreadyLinked = useMemo(() => {
      const ids = new Set<string>([issue.id]);
      for (const group of groups) for (const item of group.items) ids.add(item.issue.id);
      return ids;
   }, [issue.id, groups]);

   const candidates = useMemo(
      () => allIssues.filter((candidate) => !alreadyLinked.has(candidate.id)).slice(0, 200),
      [allIssues, alreadyLinked]
   );

   return (
      <div className="flex flex-col gap-2">
         {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
               <div key={group.relation} className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
                     {LINK_RELATION_LABEL[group.relation]}
                  </span>
                  {group.items.map((item) => (
                     <LinkRow
                        key={item.linkId}
                        relation={group.relation}
                        linked={item}
                        onRemove={() => void unlink(item.linkId)}
                     />
                  ))}
               </div>
            ))}

         <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground outline-none">
               <Plus className="size-3.5" />
               Link issue
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
               <div className="p-2 border-b">
                  <Select
                     value={relation}
                     onValueChange={(value) => setRelation(value as LinkRelation)}
                  >
                     <SelectTrigger className="w-full h-8">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        {RELATIONS.map((candidate) => (
                           <SelectItem key={candidate} value={candidate}>
                              {LINK_RELATION_LABEL[candidate]}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
               <Command>
                  <CommandInput placeholder="Find an issue…" />
                  <CommandList>
                     <CommandEmpty>No issue found.</CommandEmpty>
                     <CommandGroup>
                        {candidates.map((candidate) => (
                           <CommandItem
                              key={candidate.id}
                              value={`${candidate.identifier} ${candidate.title}`}
                              onSelect={async () => {
                                 const done = await link({
                                    issueId: issue.id,
                                    otherIssueId: candidate.id,
                                    relation,
                                    // The link is scoped to this issue's team,
                                    // which is the group both ends fan out on.
                                    teamId: issue.teamId ?? candidate.teamId ?? '',
                                 });
                                 if (done) setOpen(false);
                              }}
                           >
                              <span className="text-xs text-muted-foreground shrink-0">
                                 {candidate.identifier}
                              </span>
                              <span className="truncate">{candidate.title}</span>
                           </CommandItem>
                        ))}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </PopoverContent>
         </Popover>
      </div>
   );
}
