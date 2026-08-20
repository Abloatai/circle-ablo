'use client';

import { CreateProject } from '@/components/common/projects/create-project';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useProjects } from '@/hooks/use-workspace-data';

export default function HeaderNav() {
   const projects = useProjects();
   return (
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
         <div className="flex items-center gap-2">
            <SidebarTrigger className="" />
            <div className="flex items-center gap-1">
               <span className="text-sm font-medium">Projects</span>
               <span className="text-xs bg-accent rounded-md px-1.5 py-1">{projects.length}</span>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <CreateProject />
         </div>
      </div>
   );
}
