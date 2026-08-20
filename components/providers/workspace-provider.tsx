'use client';

import { createContext, useContext, useMemo } from 'react';
import type { Member, TeamSummary } from '@/lib/data/members';

interface WorkspaceValue {
   members: Member[];
   membersById: Map<string, Member>;
   teams: TeamSummary[];
   teamByKey: Map<string, TeamSummary>;
   /** The teams the signed-in person actually belongs to. */
   myTeamIds: Set<string>;
   viewerId: string;
   organizationId: string;
   /** What the workspace is called, and what it is addressed by in a URL. */
   organizationName: string;
   organizationSlug: string;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/**
 * People and teams for the signed-in organization.
 *
 * These come from Better Auth on the server rather than over the sync stream —
 * they change rarely, and every issue row references them by id.
 */
export function WorkspaceProvider({
   children,
   members,
   teams,
   viewerId,
   organizationId,
   organizationName,
   organizationSlug,
}: {
   children: React.ReactNode;
   members: Member[];
   teams: TeamSummary[];
   viewerId: string;
   organizationId: string;
   organizationName: string;
   organizationSlug: string;
}) {
   const value = useMemo<WorkspaceValue>(
      () => ({
         members,
         membersById: new Map(members.map((m) => [m.id, m])),
         teams,
         teamByKey: new Map(teams.map((team) => [team.key, team])),
         myTeamIds: new Set(members.find((m) => m.id === viewerId)?.teamIds ?? []),
         viewerId,
         organizationId,
         organizationName,
         organizationSlug,
      }),
      [members, teams, viewerId, organizationId, organizationName, organizationSlug]
   );

   return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
   const value = useContext(WorkspaceContext);
   if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
   return value;
}
