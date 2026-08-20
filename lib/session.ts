import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { auth } from '@/lib/auth';

/**
 * The identity every server render and the Ablo session route start from.
 *
 * `organizationId` and `teamIds` are the two fields Ablo's identityRoles read,
 * so this is deliberately the only place they are resolved — a page never
 * decides its own scope.
 */
export interface Viewer {
   id: string;
   name: string;
   email: string;
   image: string | null;
   organizationId: string;
   organizationSlug: string;
   /** What the workspace is called, as opposed to what it is addressed by. */
   organizationName: string;
   teamIds: string[];
}

export type ViewerState =
   | { kind: 'anonymous' }
   /** Signed in, but not a member of any workspace yet — needs onboarding. */
   | { kind: 'no-workspace'; userId: string }
   | { kind: 'member'; viewer: Viewer };

export async function getViewerState(): Promise<ViewerState> {
   const session = await auth.api.getSession({ headers: await headers() });
   if (!session?.user) return { kind: 'anonymous' };

   // The active organization is normally set on the session; fall back to the
   // membership so a returning member lands somewhere rather than nowhere.
   let organizationId = session.session.activeOrganizationId ?? null;
   if (!organizationId) {
      const [membership] = await db
         .select({ organizationId: t.member.organizationId })
         .from(t.member)
         .where(eq(t.member.userId, session.user.id))
         .limit(1);
      organizationId = membership?.organizationId ?? null;
   }
   if (!organizationId) return { kind: 'no-workspace', userId: session.user.id };

   const [org] = await db
      .select({ slug: t.organization.slug, name: t.organization.name })
      .from(t.organization)
      .where(eq(t.organization.id, organizationId))
      .limit(1);

   const memberships = await db
      .select({ teamId: t.teamMember.teamId })
      .from(t.teamMember)
      .innerJoin(t.team, eq(t.team.id, t.teamMember.teamId))
      .where(
         and(eq(t.teamMember.userId, session.user.id), eq(t.team.organizationId, organizationId))
      );

   return {
      kind: 'member',
      viewer: {
         id: session.user.id,
         name: session.user.name,
         email: session.user.email,
         image: session.user.image ?? null,
         organizationId,
         organizationSlug: org?.slug ?? organizationId,
         organizationName: org?.name ?? org?.slug ?? organizationId,
         teamIds: memberships.map((m) => m.teamId),
      },
   };
}

export async function getViewer(): Promise<Viewer | null> {
   const state = await getViewerState();
   return state.kind === 'member' ? state.viewer : null;
}

/** Where a signed-in member lands: their first team's issue list. */
export async function defaultRouteFor(viewer: Viewer): Promise<string> {
   const teamId = viewer.teamIds[0];
   if (!teamId) return `/${viewer.organizationSlug}/settings`;
   const [team] = await db
      .select({ key: t.team.key })
      .from(t.team)
      .where(eq(t.team.id, teamId))
      .limit(1);
   return `/${viewer.organizationSlug}/team/${team?.key ?? teamId}/all`;
}
