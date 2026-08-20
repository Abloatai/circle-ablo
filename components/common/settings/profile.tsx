'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { SettingsCard, SettingsRow, SettingsSection, SettingsShell } from './shared';
import { LeaveWorkspaceDialog } from './leave-dialogs';

/** Personal "Profile" settings. */
export default function Profile() {
   // This page showed `members[0]` — the first person in the workspace, not the
   // signed-in one — so everyone saw the same stranger's name and avatar here.
   const { membersById, viewerId, organizationName } = useWorkspace();
   const me = membersById.get(viewerId);
   const [leaving, setLeaving] = useState(false);

   if (!me) return null;

   return (
      <SettingsShell title="Profile">
         <SettingsSection>
            <SettingsCard>
               <SettingsRow
                  title="Profile picture"
                  trailing={
                     <Avatar className="size-9">
                        <AvatarImage src={me.avatarUrl} alt={me.name} />
                        <AvatarFallback>{me.name[0]}</AvatarFallback>
                     </Avatar>
                  }
               />
               <SettingsRow
                  title="Email"
                  trailing={
                     <span className="inline-flex items-center gap-2 text-foreground">
                        {me.email}
                        <Button size="icon" variant="ghost" className="size-6">
                           <Pencil className="size-3" />
                        </Button>
                     </span>
                  }
               />
               <SettingsRow
                  title="Full name"
                  trailing={<Input key={me.id} defaultValue={me.name} className="h-8 w-44" />}
               />
               <SettingsRow
                  title="Title"
                  description="Your job title or role"
                  trailing={<Input placeholder="Software engineer" className="h-8 w-44" />}
               />
               <SettingsRow
                  title="Username"
                  description="One word, like a nickname or first name"
                  trailing={
                     <Input
                        key={me.id}
                        defaultValue={me.email.split('@')[0]}
                        className="h-8 w-44"
                     />
                  }
               />
            </SettingsCard>
         </SettingsSection>

         <SettingsSection title="Workspace access">
            <SettingsCard>
               <SettingsRow
                  title="Remove yourself from workspace"
                  description={`You will lose access to everything in ${organizationName}`}
                  trailing={
                     <Button
                        size="xs"
                        variant="ghost"
                        className="text-red-500 hover:text-red-500"
                        onClick={() => setLeaving(true)}
                     >
                        Leave workspace
                     </Button>
                  }
               />
            </SettingsCard>
         </SettingsSection>
         <LeaveWorkspaceDialog
            workspaceName={organizationName}
            open={leaving}
            onOpenChange={setLeaving}
         />
      </SettingsShell>
   );
}
