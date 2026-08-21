'use client';

import { Unavailable } from '@/components/common/unavailable';
import { Button } from '@/components/ui/button';
import { Laptop } from 'lucide-react';
import { SettingsCard, SettingsRow, SettingsSection, SettingsShell } from './shared';

/** Personal "Security & access" settings (sessions, passkeys, API keys). */
export default function AccountSecurity() {
   return (
      <SettingsShell title="Security & access">
         <SettingsSection title="Sessions" description="Devices logged into your account">
            <SettingsCard>
               <SettingsRow
                  icon={<Laptop className="size-4" />}
                  title="Current browser"
                  description={
                     <span className="inline-flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-[#00cc66]" />
                        <span className="text-[#00a05a]">Current session</span> · This browser
                     </span>
                  }
               />
            </SettingsCard>
         </SettingsSection>

         <SettingsSection
            title="Passkeys"
            description="Passkeys are a secure way to sign in to your account"
         >
            <SettingsCard>
               <SettingsRow
                  title="No passkeys registered"
                  trailing={
                     <Unavailable reason="Passkeys are not built">
                        <Button size="xs" variant="ghost" disabled>
                           New passkey
                        </Button>
                     </Unavailable>
                  }
               />
            </SettingsCard>
         </SettingsSection>

         <SettingsSection
            title="Personal API keys"
            description="Use the GraphQL API to build your own integrations"
         >
            <SettingsCard>
               <SettingsRow
                  title="No API keys"
                  trailing={
                     <Unavailable reason="There is no API-key system">
                        <Button size="xs" variant="ghost" disabled>
                           New API key
                        </Button>
                     </Unavailable>
                  }
               />
            </SettingsCard>
         </SettingsSection>

         <SettingsSection
            title="Commit signing key"
            description="Coding sessions use this key to sign your commits"
         >
            <SettingsCard>
               <SettingsRow
                  title="No signing key added"
                  trailing={
                     <Unavailable reason="Commit signing is not built">
                        <Button size="xs" variant="ghost" disabled>
                           Add key
                        </Button>
                     </Unavailable>
                  }
               />
            </SettingsCard>
         </SettingsSection>
      </SettingsShell>
   );
}
