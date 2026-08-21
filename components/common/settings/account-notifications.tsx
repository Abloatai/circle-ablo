'use client';

import { Switch } from '@/components/ui/switch';
import { Mail, Monitor, Slack, Smartphone } from 'lucide-react';
import { SettingsCard, SettingsRow, SettingsSection, SettingsShell } from './shared';

const CHANNELS = [
   {
      icon: <Monitor className="size-4" />,
      title: 'Desktop',
   },
   {
      icon: <Smartphone className="size-4" />,
      title: 'Mobile',
   },
   { icon: <Mail className="size-4" />, title: 'Email' },
   { icon: <Slack className="size-4" />, title: 'Slack' },
];

/** Personal notification settings (push channels + product updates). */
export default function AccountNotifications() {
   return (
      <SettingsShell title="Notifications">
         <SettingsSection
            title="Push notifications"
            description="Choose which notifications are pushed to your devices. All notifications will still appear in your inbox."
         >
            <SettingsCard>
               {CHANNELS.map((channel) => (
                  <SettingsRow
                     key={channel.title}
                     icon={channel.icon}
                     title={channel.title}
                     description="Notification channel preferences are not available yet"
                     chevron
                     disabled
                  />
               ))}
            </SettingsCard>
         </SettingsSection>

         <SettingsSection
            title="Updates from Circle"
            description="Subscribe to product announcements and important changes from the Circle team"
         >
            <h3 className="text-sm font-medium mt-2">Changelog</h3>
            <SettingsCard>
               <SettingsRow
                  title="Show updates in sidebar"
                  description="Highlight new features and improvements in the app sidebar"
                  trailing={<Switch defaultChecked disabled />}
                  disabled
               />
               <SettingsRow
                  title="Changelog newsletter"
                  description="Receive an email twice a month highlighting new features and improvements"
                  trailing={<Switch disabled />}
                  disabled
               />
            </SettingsCard>

            <h3 className="text-sm font-medium mt-2">Marketing</h3>
            <SettingsCard>
               <SettingsRow
                  title="Marketing and onboarding"
                  description="Occasional updates to help you get the most out of Circle"
                  trailing={<Switch disabled />}
                  disabled
               />
            </SettingsCard>

            <h3 className="text-sm font-medium mt-2">Other updates</h3>
            <SettingsCard>
               <SettingsRow
                  title="Invite accepted"
                  description="Receive an email when an invite you sent is accepted"
                  trailing={<Switch defaultChecked disabled />}
                  disabled
               />
               <SettingsRow
                  title="Privacy and legal updates"
                  description="Important updates about terms of service or privacy policy changes"
                  trailing={<Switch defaultChecked disabled />}
                  disabled
               />
            </SettingsCard>
         </SettingsSection>
      </SettingsShell>
   );
}
