'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Leaves settings for wherever this person's work is.
 *
 * Both halves of that destination used to be literals — the workspace slug and
 * the team key `CORE` — so "Back to app" only worked in the seeded workspace and
 * led nowhere in any other. It goes to a team the viewer is actually on now,
 * and to the workspace root if they are on none.
 */
export function BackToApp() {
   const { organizationSlug, teams, myTeamIds } = useWorkspace();
   const team = teams.find((candidate) => myTeamIds.has(candidate.id));
   const href = team ? `/${organizationSlug}/team/${team.key}/all` : `/${organizationSlug}`;

   return (
      <div className="w-full flex items-center justify-between gap-2">
         <Button className="w-fit" size="xs" variant="outline" asChild>
            <Link href={href}>
               <ChevronLeft className="size-4" />
               Back to app
            </Link>
         </Button>
         <ThemeToggle />
      </div>
   );
}
