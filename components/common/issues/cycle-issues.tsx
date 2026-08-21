'use client';

import { CycleDetailsPanel } from '@/components/common/cycles/cycle-details-panel';
import { useParams } from 'next/navigation';
import { useTeamCycles } from '@/hooks/use-workspace-data';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useFilterStore } from '@/store/filter-store';
import { useIssues, useTeamStatuses } from '@/hooks/use-workspace-data';
import { applyIssueFilters } from './issue-filter-columns';
import { IssueFilterBar } from './issue-filter-bar';
import { useRightPanelStore } from '@/store/right-panel-store';
import { useSearchStore } from '@/store/search-store';
import { useViewStore } from '@/store/view-store';
import { useMemo } from 'react';
import { GroupedIssuesView } from './grouped-issues-view';
import { InsightsPanel } from './insights-panel';
import { SearchIssues } from './search-issues';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useCreateIssueStore } from '@/store/create-issue-store';

export type CycleView = 'active' | 'upcoming';

interface CycleIssuesProps {
   /** 'active' = current cycle, 'upcoming' = next cycle. */
   cycleView: CycleView;
}

/**
 * Issue view scoped to a cycle — same behavior as AllIssues (search,
 * filters, list/board) plus the cycle details / insights side panels.
 */
export default function CycleIssues({ cycleView }: CycleIssuesProps) {
   const params = useParams<{ orgId?: string; teamId?: string }>();
   const { teamByKey } = useWorkspace();
   const teamId = params?.teamId ? (teamByKey.get(params.teamId)?.id ?? params.teamId) : undefined;
   const { current, upcoming } = useTeamCycles(teamId);
   const { isSearchOpen, searchQuery } = useSearchStore();
   const { viewType } = useViewStore();
   const { filters } = useFilterStore();
   const issues = useIssues();
   const displayOrderedStatus = useTeamStatuses(teamId);
   const { openPanel } = useRightPanelStore();
   const { openModal } = useCreateIssueStore();

   const cycle = cycleView === 'active' ? current : upcoming;

   const isSearching = isSearchOpen && searchQuery.trim() !== '';
   const isViewTypeGrid = viewType === 'grid';

   // A team may have no current or upcoming cycle; the view says so below.
   const cycleIssues = useMemo(
      () => (cycle ? issues.filter((issue) => issue.cycleId === cycle.id) : []),
      [issues, cycle]
   );

   const displayedIssues = useMemo(
      () => applyIssueFilters(cycleIssues, filters),
      [cycleIssues, filters]
   );

   if (isSearching) {
      return (
         <div className="w-full h-full">
            <div className="px-6 mb-6">
               <SearchIssues />
            </div>
         </div>
      );
   }

   if (!cycle) {
      return (
         <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium">
               No {cycleView === 'active' ? 'current' : 'upcoming'} cycle
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
               Your team’s issues are still available in the Issues view. Create a cycle or change a
               cycle’s status before planning work here.
            </p>
            {params.orgId && params.teamId && (
               <Button asChild size="sm" variant="secondary">
                  <Link href={`/${params.orgId}/team/${params.teamId}/cycles`}>View cycles</Link>
               </Button>
            )}
         </div>
      );
   }

   if (cycleIssues.length === 0) {
      return (
         <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium">No issues in {cycle.name}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
               Issues only appear here after they are assigned to this cycle. Existing team issues
               have not been removed.
            </p>
            <div className="flex items-center gap-2">
               <Button size="sm" onClick={() => openModal(undefined, undefined, cycle.id)}>
                  Create issue in cycle
               </Button>
               {params.orgId && params.teamId && (
                  <Button asChild size="sm" variant="secondary">
                     <Link href={`/${params.orgId}/team/${params.teamId}/all`}>
                        View team issues
                     </Link>
                  </Button>
               )}
            </div>
         </div>
      );
   }

   return (
      <div className="w-full h-full flex flex-col overflow-hidden">
         <IssueFilterBar />
         <div className="flex-1 min-h-0 w-full flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
               <GroupedIssuesView
                  issues={displayedIssues}
                  totalIssues={cycleIssues}
                  statuses={displayOrderedStatus}
                  isViewTypeGrid={isViewTypeGrid}
                  defaultCycleId={cycle.id}
               />
            </div>

            {openPanel === 'insights' && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <InsightsPanel issues={displayedIssues} />
               </aside>
            )}
            {openPanel === 'cycle-details' && cycle && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <CycleDetailsPanel cycle={cycle} issues={cycleIssues} />
               </aside>
            )}
         </div>
      </div>
   );
}
