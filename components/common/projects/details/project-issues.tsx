'use client';

import { GroupedIssuesView } from '@/components/common/issues/grouped-issues-view';
import { applyIssueFilters } from '@/components/common/issues/issue-filter-columns';
import { IssueFilterBar } from '@/components/common/issues/issue-filter-bar';
import { useProjects } from '@/hooks/use-workspace-data';
import { ProjectMissing } from './project-missing';
import { displayOrderedStatus } from '@/lib/domain/status';
import { useFilterStore } from '@/store/filter-store';
import { useIssues } from '@/hooks/use-workspace-data';
import { useMemo } from 'react';
import { ProjectSidePanel } from './project-side-panel';

interface ProjectIssuesProps {
   projectId: string;
}

/** Project "Issues" tab: the project's issues grouped by status. */
export default function ProjectIssues({ projectId }: ProjectIssuesProps) {
   const allProjects = useProjects();
   const getProjectById = (id: string) => allProjects.find((project) => project.id === id);
   const project = getProjectById(projectId);
   const allIssues = useIssues();
   const { filters } = useFilterStore();

   const issues = useMemo(
      () => allIssues.filter((issue) => issue.project?.id === projectId),
      [allIssues, projectId]
   );

   // Filters (filter bar + click-to-filter from the insights panel) apply
   // on top of the project scope.
   const displayedIssues = useMemo(() => applyIssueFilters(issues, filters), [issues, filters]);

   if (!project) return <ProjectMissing projectId={projectId} />;

   return (
      <div className="w-full h-full flex flex-col overflow-hidden">
         <IssueFilterBar />
         <div className="flex-1 min-h-0 w-full flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
               <GroupedIssuesView
                  issues={displayedIssues}
                  totalIssues={issues}
                  statuses={displayOrderedStatus}
                  isViewTypeGrid={false}
               />
            </div>
            <ProjectSidePanel project={project} issues={issues} insightsIssues={displayedIssues} />
         </div>
      </div>
   );
}
