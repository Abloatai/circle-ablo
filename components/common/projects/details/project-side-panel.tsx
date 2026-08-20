'use client';

import { InsightsPanel } from '@/components/common/issues/insights-panel';
import { Issue } from '@/lib/domain/issues';
import { Project } from '@/lib/domain/projects';
import { useRightPanelStore } from '@/store/right-panel-store';
import { ProjectPropertiesPanel } from './project-properties-panel';

interface ProjectSidePanelProps {
   project: Project;
   issues: Issue[];
   /** Issues shown by the insights panel (e.g. after filters); defaults to `issues`. */
   insightsIssues?: Issue[];
}

/**
 * Right panel of the project pages. Properties are shown by default;
 * the header icons switch to the insights panel or collapse it entirely
 * (right-panel-store: null = properties, 'insights', 'hidden').
 */
export function ProjectSidePanel({ project, issues, insightsIssues }: ProjectSidePanelProps) {
   const { openPanel } = useRightPanelStore();

   if (openPanel === 'hidden') return null;

   return (
      <aside className="hidden xl:flex w-[380px] shrink-0 border-l h-full overflow-hidden bg-container">
         {openPanel === 'insights' ? (
            <InsightsPanel issues={insightsIssues ?? issues} />
         ) : (
            <ProjectPropertiesPanel project={project} issues={issues} />
         )}
      </aside>
   );
}
