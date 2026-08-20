'use client';

import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTeams } from '@/hooks/use-workspace-data';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useWorkspace } from '@/components/providers/workspace-provider';

export default function HeaderNav() {
   const teams = useTeams();
   const { organizationSlug } = useWorkspace();
   return (
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
         <div className="flex items-center gap-2">
            <SidebarTrigger className="" />
            <div className="flex items-center gap-1">
               <span className="text-sm font-medium">Teams</span>
               <span className="text-xs bg-accent rounded-md px-1.5 py-1">{teams.length}</span>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <Button className="relative" size="xs" variant="secondary" asChild>
               <Link href={`/${organizationSlug}/settings/teams/new`}>
                  <Plus className="size-4" />
                  Add team
               </Link>
            </Button>
         </div>
      </div>
   );
}
