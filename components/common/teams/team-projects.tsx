'use client';

import Projects from '@/components/common/projects/projects';
import { useRouteTeam } from '@/hooks/use-workspace-data';

/**
 * Team "Projects" page: the exact same projects experience as /projects
 * (tabs, filters, display options, list/board/timeline, insights) scoped
 * to the team.
 */
export default function TeamProjects({ teamId }: { teamId: string }) {
   const team = useRouteTeam(teamId);
   if (!team)
      return <div className="px-6 py-10 text-sm text-muted-foreground">Team not found.</div>;
   return <Projects teamId={team.id} />;
}
