'use client';

import { Button } from '@/components/ui/button';
import { ExternalLink, GitPullRequestArrow, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SettingsCard, SettingsRow, SettingsSection, SettingsShell } from './shared';

export default function AccountCodeReviews() {
   const { orgId } = useParams<{ orgId: string }>();

   return (
      <SettingsShell
         title="Code & reviews"
         description="Review pull requests from repositories connected through your GitHub App"
      >
         <SettingsSection>
            <SettingsCard>
               <SettingsRow
                  title="GitHub repositories"
                  description="Choose which repositories are enabled and map each one to a Circle team"
                  trailing={
                     <Button size="sm" variant="outline" asChild>
                        <Link href={`/${orgId}/settings/integrations`}>
                           <Settings2 className="size-4" />
                           Configure
                        </Link>
                     </Button>
                  }
               />
               <SettingsRow
                  title="Pull request inbox"
                  description="Browse live pull requests, inspect real diffs, and submit reviews back to GitHub"
                  trailing={
                     <Button size="sm" asChild>
                        <Link href={`/${orgId}/reviews`}>
                           <GitPullRequestArrow className="size-4" />
                           Open reviews
                        </Link>
                     </Button>
                  }
               />
            </SettingsCard>
         </SettingsSection>

         <SettingsSection
            title="Required GitHub permissions"
            description="Circle uses short-lived installation tokens; repository credentials are never sent to the browser"
         >
            <SettingsCard>
               <SettingsRow
                  title="Pull requests: Read and write"
                  description="Read metadata and diffs, then post comments, approvals, or change requests"
               />
               <SettingsRow
                  title="Contents: Read and write"
                  description="Required only for the separate admin-approved merge workflow"
                  trailing={
                     <Button size="sm" variant="ghost" asChild>
                        <a
                           href="https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app"
                           target="_blank"
                           rel="noreferrer"
                        >
                           GitHub docs
                           <ExternalLink className="size-4" />
                        </a>
                     </Button>
                  }
               />
            </SettingsCard>
         </SettingsSection>
      </SettingsShell>
   );
}
