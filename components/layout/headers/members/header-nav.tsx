'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * The Members page title bar.
 *
 * It used to carry its own "Invite" button with no handler, sitting inches from
 * the real `InviteMember` dialog that `header.tsx` renders next to it. Two
 * invite buttons, one of which did nothing.
 */
export default function HeaderNav() {
   const { members: users } = useWorkspace();
   return (
      <div className="w-full flex justify-between items-center border-b py-1.5 px-6 h-10">
         <div className="flex items-center gap-2">
            <SidebarTrigger className="" />
            <div className="flex items-center gap-1">
               <span className="text-sm font-medium">Members</span>
               <span className="text-xs bg-accent rounded-md px-1.5 py-1">{users.length}</span>
            </div>
         </div>
      </div>
   );
}
