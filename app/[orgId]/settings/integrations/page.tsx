import { notFound } from 'next/navigation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import Integrations from '@/components/common/settings/integrations';
import { db } from '@/db';
import * as t from '@/db/schema';
import Header from '@/components/layout/headers/settings/header';
import MainLayout from '@/components/layout/main-layout';
import { isGitHubAppConfigured } from '@/lib/github/config';
import { canManageWorkspace, getViewer } from '@/lib/session';

export default async function IntegrationsSettingsPage({
   params,
   searchParams,
}: {
   params: Promise<{ orgId: string }>;
   searchParams: Promise<{ github?: string }>;
}) {
   const [{ orgId }, query, viewer] = await Promise.all([params, searchParams, getViewer()]);
   if (!viewer || viewer.organizationSlug !== orgId) notFound();
   const canManage = canManageWorkspace(viewer);

   const [installationRows, repositoryRows, teams] = await Promise.all([
      db
         .select()
         .from(t.githubInstallation)
         .where(eq(t.githubInstallation.organizationId, viewer.organizationId)),
      db
         .select({
            id: t.githubRepository.id,
            installationRecordId: t.githubRepository.installationId,
            fullName: t.githubRepository.fullName,
            htmlUrl: t.githubRepository.htmlUrl,
            private: t.githubRepository.private,
            enabled: t.githubRepository.enabled,
            teamId: t.githubRepository.teamId,
         })
         .from(t.githubRepository)
         .innerJoin(
            t.githubInstallation,
            eq(t.githubInstallation.id, t.githubRepository.installationId)
         )
         .where(
            and(
               eq(t.githubInstallation.organizationId, viewer.organizationId),
               canManage
                  ? undefined
                  : viewer.teamIds.length
                    ? inArray(t.githubRepository.teamId, viewer.teamIds)
                    : sql`false`
            )
         ),
      db
         .select({ id: t.team.id, name: t.team.name })
         .from(t.team)
         .where(
            and(
               eq(t.team.organizationId, viewer.organizationId),
               canManage
                  ? undefined
                  : viewer.teamIds.length
                    ? inArray(t.team.id, viewer.teamIds)
                    : sql`false`
            )
         ),
   ]);

   const installations = installationRows
      .map((installation) => ({
         id: installation.id,
         installationId: installation.installationId,
         accountLogin: installation.accountLogin,
         repositorySelection: installation.repositorySelection,
         suspended: installation.suspendedAt !== null,
         repositories: repositoryRows
            .filter((repository) => repository.installationRecordId === installation.id)
            .map((repository) => ({
               id: repository.id,
               fullName: repository.fullName,
               htmlUrl: repository.htmlUrl,
               private: repository.private,
               enabled: repository.enabled,
               teamId: repository.teamId,
            })),
      }))
      .filter((installation) => canManage || installation.repositories.length > 0);

   return (
      <MainLayout header={<Header />} headersNumber={1}>
         <Integrations
            configured={isGitHubAppConfigured()}
            canManage={canManage}
            result={query.github}
            teams={teams}
            installations={installations}
         />
      </MainLayout>
   );
}
