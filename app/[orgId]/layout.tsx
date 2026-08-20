import { redirect } from 'next/navigation';
import { Providers } from '@/app/providers';
import { PresenceProvider } from '@/components/providers/presence-provider';
import { WorkspaceProvider } from '@/components/providers/workspace-provider';
import { getMembers, getTeams } from '@/lib/data/members';
import { getViewerState } from '@/lib/session';

/**
 * Everything under /[orgId] requires a signed-in member, and everything under
 * it reads live data — so this is where the Ablo connection is mounted.
 */
export default async function OrgLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: Promise<{ orgId: string }>;
}) {
   const state = await getViewerState();
   if (state.kind === 'anonymous') redirect('/sign-in');
   if (state.kind === 'no-workspace') redirect('/onboarding');
   const { viewer } = state;

   const { orgId } = await params;
   // The URL is a label, not authority: a member who types someone else's
   // workspace slug is sent back to their own.
   if (orgId !== viewer.organizationSlug) redirect(`/${viewer.organizationSlug}`);

   // People and teams come from Better Auth on the server; work data arrives
   // over the sync stream inside <Providers>.
   const [members, teams] = await Promise.all([
      getMembers(viewer.organizationId),
      getTeams(viewer.organizationId),
   ]);

   return (
      <Providers userId={viewer.id}>
         <WorkspaceProvider
            members={members}
            teams={teams}
            viewerId={viewer.id}
            organizationId={viewer.organizationId}
            organizationName={viewer.organizationName}
            organizationSlug={viewer.organizationSlug}
         >
            <PresenceProvider>{children}</PresenceProvider>
         </WorkspaceProvider>
      </Providers>
   );
}
