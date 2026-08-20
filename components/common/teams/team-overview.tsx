'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useCycles, useIssues, useTeamDocuments } from '@/hooks/use-workspace-data';
import { TeamDescription } from './team-description';
import { useTeams } from '@/hooks/use-workspace-data';
import { RiDonutChartFill } from '@remixicon/react';
import { Box, CopyMinus, FileText, Layers, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Team Home — "Overview" tab: team identity, pinned resources and
 * quick links, Linear-style.
 */
export default function TeamOverview() {
   const teams = useTeams();
   const { orgId, teamId } = useParams<{ orgId: string; teamId: string }>();
   // No `?? teams[0]`: falling back showed a different team's name, members and
   // documents under this team's URL, which is worse than saying nothing.
   const team = teams.find((t) => t.id === teamId);

   const folders = useTeamDocuments(teamId);
   const issues = useIssues();
   const teamCycles = useCycles().filter((cycle) => cycle.teamId === teamId);

   const documents = folders.flatMap((folder) => folder.documents);
   const teamIssues = issues.filter((issue) => issue.teamId === teamId);
   const openIssues = teamIssues.filter(
      (issue) => issue.status?.category !== 'completed' && issue.status?.category !== 'canceled'
   );

   if (!team) {
      return (
         <div className="w-full max-w-5xl mx-auto px-8 py-10">
            <h1 className="text-2xl font-medium">Team not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
               It may have been deleted, or you may have left it.
            </p>
         </div>
      );
   }

   const goToLinks = [
      {
         label: 'Team settings',
         icon: Settings,
         href: `/${orgId}/settings/teams/${team.id}`,
      },
      { label: 'Issues', icon: CopyMinus, href: `/${orgId}/team/${team.id}/all` },
      { label: 'Cycles', icon: RiDonutChartFill, href: `/${orgId}/team/${team.id}/cycles` },
      { label: 'Projects', icon: Box, href: `/${orgId}/team/${team.id}/projects` },
      { label: 'Views', icon: Layers, href: `/${orgId}/team/${team.id}/views` },
      { label: 'Documents', icon: FileText, href: `/${orgId}/team/${team.id}/documents` },
   ];

   return (
      <div className="w-full max-w-5xl mx-auto px-8 py-10 flex flex-col lg:flex-row gap-12">
         {/* Main column */}
         <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
               <div className="inline-flex size-12 bg-muted/50 items-center justify-center rounded-lg text-2xl shrink-0">
                  {team.icon}
               </div>
               <h1 className="text-3xl font-semibold">{team.name}</h1>
            </div>

            <TeamDescription teamId={team.id} initial={team.description ?? ''} />

            <div className="mt-8 flex items-center gap-6 text-sm">
               <Link
                  href={`/${orgId}/team/${team.id}/all`}
                  className="hover:text-foreground text-muted-foreground"
               >
                  <span className="font-medium text-foreground">{openIssues.length}</span> open of{' '}
                  {teamIssues.length} issues
               </Link>
               <Link
                  href={`/${orgId}/team/${team.id}/cycles`}
                  className="hover:text-foreground text-muted-foreground"
               >
                  <span className="font-medium text-foreground">{teamCycles.length}</span>{' '}
                  {teamCycles.length === 1 ? 'cycle' : 'cycles'}
               </Link>
            </div>

            <div className="mt-12">
               <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Team documents</h2>
                  <Button variant="ghost" size="xs" asChild>
                     <Link href={`/${orgId}/team/${team.id}/documents`}>Open documents</Link>
                  </Button>
               </div>

               <div className="mt-4 flex flex-col gap-1">
                  {documents.length === 0 && (
                     <p className="text-sm text-muted-foreground">
                        No documents yet.{' '}
                        <Link
                           href={`/${orgId}/team/${team.id}/documents`}
                           className="underline hover:text-foreground"
                        >
                           Write one
                        </Link>
                        .
                     </p>
                  )}
                  {documents.slice(0, 8).map((doc) => (
                     <Link
                        key={doc.id}
                        href={`/${orgId}/team/${team.id}/documents`}
                        className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-sidebar/50 text-sm"
                     >
                        <span className="text-base leading-none">{doc.icon}</span>
                        <span className="font-medium">{doc.title}</span>
                     </Link>
                  ))}
               </div>
            </div>
         </div>

         {/* Side column */}
         <div className="w-full lg:w-60 shrink-0">
            <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
            <Link
               href={`/${orgId}/team/${team.id}/members`}
               className="mt-2 flex items-center gap-2 hover:opacity-80"
            >
               <div className="flex -space-x-1.5">
                  {team.members.slice(0, 4).map((member) => (
                     <Avatar key={member.id} className="size-5 ring-2 ring-background">
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                     </Avatar>
                  ))}
               </div>
               <span className="text-sm text-muted-foreground">{team.members.length}</span>
            </Link>

            <h3 className="text-sm font-medium text-muted-foreground mt-8">Go to</h3>
            <div className="mt-2 flex flex-col">
               {goToLinks.map((link) => (
                  <Link
                     key={link.label}
                     href={link.href}
                     className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-sidebar/50 text-sm"
                  >
                     <link.icon className="size-4 text-muted-foreground" />
                     {link.label}
                  </Link>
               ))}
            </div>
         </div>
      </div>
   );
}
