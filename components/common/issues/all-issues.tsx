'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useIssues, useTeamStatuses } from '@/hooks/use-workspace-data';
import type { HydratedIssue } from '@/lib/data/hydrate';
import { StatusCategory } from '@/lib/domain/status';
import { useFilterStore } from '@/store/filter-store';
import { useRightPanelStore } from '@/store/right-panel-store';
import { useSearchStore } from '@/store/search-store';
import { useViewStore } from '@/store/view-store';
import { GroupedIssuesView } from './grouped-issues-view';
import { InsightsPanel } from './insights-panel';
import { IssueFilterBar } from './issue-filter-bar';
import { applyIssueFilters } from './issue-filter-columns';
import { SearchIssues } from './search-issues';

interface AllIssuesProps {
   /**
    * Optional status-category filter, used by the "Active" and "Backlog"
    * tabs. When omitted, every status is shown ("All issues").
    */
   categories?: StatusCategory[];
   /**
    * Team key from the URL (CORE, DESIGN…). When set, only that team's issues
    * are shown. The viewer's sync groups already bound what arrived; this
    * narrows the several teams they belong to down to the one they're looking at.
    */
   teamKey?: string;
}

export default function AllIssues({ categories, teamKey }: AllIssuesProps) {
   const { isSearchOpen, searchQuery } = useSearchStore();
   const { viewType } = useViewStore();
   const { filters } = useFilterStore();
   const { openPanel } = useRightPanelStore();
   const { teamByKey } = useWorkspace();
   const teamId = teamKey ? (teamByKey.get(teamKey)?.id ?? teamKey) : undefined;

   const allIssues = useIssues();
   const allStatuses = useTeamStatuses(teamId);

   const isSearching = isSearchOpen && searchQuery.trim() !== '';
   const isViewTypeGrid = viewType === 'grid';

   const statuses = useMemo(
      () => (categories ? allStatuses.filter((s) => categories.includes(s.category)) : allStatuses),
      [allStatuses, categories]
   );

   const scopedIssues = useMemo<HydratedIssue[]>(() => {
      let scoped = allIssues;
      if (teamId) scoped = scoped.filter((issue) => issue.teamId === teamId);
      if (categories) scoped = scoped.filter((issue) => categories.includes(issue.status.category));
      return scoped;
   }, [allIssues, teamId, categories]);

   const displayedIssues = useMemo(
      () => applyIssueFilters(scopedIssues, filters),
      [scopedIssues, filters]
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

   return (
      <div className="w-full h-full flex flex-col overflow-hidden">
         <IssueFilterBar />
         <div className="flex-1 min-h-0 w-full flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
               <GroupedIssuesView
                  issues={displayedIssues}
                  totalIssues={scopedIssues}
                  statuses={statuses}
                  isViewTypeGrid={isViewTypeGrid}
               />
            </div>

            {openPanel === 'insights' && (
               <aside className="hidden lg:flex w-[420px] shrink-0 border-l h-full overflow-hidden bg-container">
                  <InsightsPanel issues={displayedIssues} />
               </aside>
            )}
         </div>
      </div>
   );
}
