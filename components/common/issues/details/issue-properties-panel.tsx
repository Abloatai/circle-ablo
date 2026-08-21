'use client';

import { Button } from '@/components/ui/button';
import { useIssueLinks, useIssueMilestone } from '@/hooks/use-workspace-data';
import type { HydratedIssue } from '@/lib/data/hydrate';
import { Plus } from 'lucide-react';
import { AssigneeUser } from '../assignee-user';
import { LabelBadge } from '../label-badge';
import { PrioritySelector } from '../priority-selector';
import { StatusSelector } from '../status-selector';
import { IssueRelations } from './issue-relations';
import { IssuePullRequests } from './issue-pull-requests';
import { CycleSelector } from '../cycle-selector';

interface IssuePropertiesPanelProps {
   issue: HydratedIssue;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
   return (
      <div>
         <h3 className="text-xs font-medium text-muted-foreground mb-2">{title}</h3>
         {children}
      </div>
   );
}

/**
 * Right sidebar of the issue page: editable properties (status, priority,
 * assignee), cycle, labels, project + milestone, relations and linked PRs.
 */
export function IssuePropertiesPanel({ issue }: IssuePropertiesPanelProps) {
   const links = useIssueLinks(issue.id);
   const milestone = useIssueMilestone(issue);

   return (
      <div className="flex flex-col gap-7">
         <Section title="Properties">
            <div className="flex flex-col gap-1.5">
               <div className="flex items-center gap-1.5 -ml-1.5">
                  <StatusSelector status={issue.status} issueId={issue.id} teamId={issue.teamId} />
                  <span className="text-sm">{issue.status.name}</span>
               </div>
               <div className="flex items-center gap-1.5 -ml-1.5">
                  <PrioritySelector priority={issue.priority} issueId={issue.id} />
                  <span className="text-sm">{issue.priority.name}</span>
               </div>
               <div className="flex items-center gap-2 mt-0.5">
                  <AssigneeUser user={issue.assignee} issueId={issue.id} teamId={issue.teamId} />
                  <span className="text-sm">{issue.assignee ? issue.assignee.name : 'Assign'}</span>
               </div>
               <CycleSelector cycleId={issue.cycleId} issueId={issue.id} teamId={issue.teamId} />
            </div>
         </Section>

         <Section title="Labels">
            <div className="flex items-center flex-wrap gap-1.5">
               <LabelBadge label={issue.labels} />
               <Button variant="ghost" size="icon" className="size-6 rounded-full border">
                  <Plus className="size-3.5" />
               </Button>
            </div>
         </Section>

         {issue.project && (
            <Section title="Project">
               <div className="flex items-center gap-2 text-sm">
                  <issue.project.icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{issue.project.name}</span>
               </div>
               {milestone && (
                  <div className="flex items-center gap-2 text-sm mt-1.5 pl-6 text-muted-foreground">
                     <span className="size-2 rotate-45 border border-amber-400 shrink-0" />
                     <span className="truncate">{milestone.name}</span>
                  </div>
               )}
            </Section>
         )}

         <Section title="Relations">
            <IssueRelations issue={issue} links={links} />
         </Section>

         <Section title="Diffs">
            <IssuePullRequests issueId={issue.id} teamId={issue.teamId ?? ''} />
         </Section>
      </div>
   );
}
