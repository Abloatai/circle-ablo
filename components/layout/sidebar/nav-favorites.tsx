'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Box, FileText, Layers, LayoutList, Star, ContactRound } from 'lucide-react';

import {
   SidebarGroup,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useFavorites, type FavoriteEntityType } from '@/hooks/use-favorite-actions';
import {
   useCycles,
   useIssues,
   useProjects,
   useSavedViews,
   useTeams,
} from '@/hooks/use-workspace-data';

const ICONS: Record<FavoriteEntityType, typeof Star> = {
   issue: LayoutList,
   project: Box,
   cycle: Layers,
   document: FileText,
   view: Layers,
   team: ContactRound,
};

/**
 * The Favorites section.
 *
 * A star with nowhere to appear is not a feature, so this is the other half of
 * `useFavoriteActions`. It resolves each favourite against the synced pool
 * rather than storing a name on the row: rename an issue and this list renames
 * with it, and a favourite whose target has been deleted simply stops
 * rendering rather than becoming a dead link.
 *
 * The whole group disappears when nothing is starred, so an empty workspace
 * does not carry an empty heading.
 */
interface FavoriteLink {
   id: string;
   name: string;
   type: FavoriteEntityType;
   href: string;
}

export function NavFavorites() {
   const { orgId } = useParams<{ orgId: string }>();
   const favorites = useFavorites();
   const issues = useIssues();
   const projects = useProjects();
   const cycles = useCycles();
   const views = useSavedViews();
   const teams = useTeams();

   const resolved = favorites
      .map((favorite): FavoriteLink | undefined => {
         switch (favorite.entityType) {
            case 'issue': {
               const issue = issues.find((candidate) => candidate.id === favorite.entityId);
               return (
                  issue && {
                     id: favorite.id,
                     name: issue.title,
                     type: favorite.entityType,
                     href: `/${orgId}/issue/${issue.identifier}`,
                  }
               );
            }
            case 'project': {
               const project = projects.find((candidate) => candidate.id === favorite.entityId);
               return (
                  project && {
                     id: favorite.id,
                     name: project.name,
                     type: favorite.entityType,
                     href: `/${orgId}/project/${project.id}/overview`,
                  }
               );
            }
            case 'cycle': {
               const cycle = cycles.find((candidate) => candidate.id === favorite.entityId);
               return (
                  cycle && {
                     id: favorite.id,
                     name: cycle.name,
                     type: favorite.entityType,
                     href: `/${orgId}/team/${cycle.teamId}/cycles`,
                  }
               );
            }
            case 'view': {
               const view = views.find((candidate) => candidate.id === favorite.entityId);
               return (
                  view && {
                     id: favorite.id,
                     name: view.name,
                     type: favorite.entityType,
                     href: `/${orgId}/view/${view.id}`,
                  }
               );
            }
            case 'team': {
               const team = teams.find((candidate) => candidate.id === favorite.entityId);
               return (
                  team && {
                     id: favorite.id,
                     name: team.name,
                     type: favorite.entityType,
                     href: `/${orgId}/team/${team.id}/all`,
                  }
               );
            }
            default:
               return undefined;
         }
      })
      .filter((item): item is FavoriteLink => Boolean(item));

   if (resolved.length === 0) return null;

   return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
         <SidebarGroupLabel>Favorites</SidebarGroupLabel>
         <SidebarMenu>
            {resolved.map((item) => {
               const Icon = ICONS[item.type];
               return (
                  <SidebarMenuItem key={item.id}>
                     <SidebarMenuButton asChild>
                        <Link href={item.href}>
                           <Icon />
                           <span className="truncate">{item.name}</span>
                        </Link>
                     </SidebarMenuButton>
                  </SidebarMenuItem>
               );
            })}
         </SidebarMenu>
      </SidebarGroup>
   );
}
