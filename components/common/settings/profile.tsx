'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { SettingsCard, SettingsRow, SettingsSection, SettingsShell } from './shared';
import { LeaveWorkspaceDialog } from './leave-dialogs';
import { ProfileField } from './profile-field';
import { Unavailable } from '@/components/common/unavailable';

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
                  trailing={
                     <ProfileField key={me.id} field="name" label="Full name" initial={me.name} />
                  }
               />
               <SettingsRow
                  title="Title"
                  description="Your job title or role, shown on your member profile"
                  trailing={
                     <ProfileField
                        key={me.id}
                        field="title"
                        label="Title"
                        initial={me.title ?? ''}
                        placeholder="Software engineer"
                     />
                  }
               />
               <SettingsRow
                  title="Username"
                  description="Nothing resolves a handle yet — there are no @mentions to look one up"
                  trailing={
                     <Unavailable reason="There is no mention system for a handle to resolve against">
                        <Input
                           disabled
                           value={me.email.split('@')[0]}
                           readOnly
                           className="h-8 w-44"
                        />
                     </Unavailable>
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
