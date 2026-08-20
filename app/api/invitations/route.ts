import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { auth } from '@/lib/auth';
import { getViewer } from '@/lib/session';

/**
 * Invites someone to the workspace.
 *
 * Better Auth owns the invitation record and the email; this route exists to
 * check the caller is a member of the organization they are inviting into, and
 * to put the new member on a team, which the plugin does not do for us.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { email, role, teamId } = (await request.json()) as {
      email?: string;
      role?: 'member' | 'admin' | 'owner';
      teamId?: string;
   };

   const address = email?.trim().toLowerCase();
   if (!address || !address.includes('@')) {
      return Response.json({ error: 'A valid email address is required' }, { status: 400 });
   }
   if (teamId && !viewer.teamIds.includes(teamId)) {
      return Response.json({ error: 'Not your team' }, { status: 403 });
   }

   const [existing] = await db
      .select({ id: t.user.id })
      .from(t.user)
      .innerJoin(t.member, eq(t.member.userId, t.user.id))
      .where(and(eq(t.user.email, address), eq(t.member.organizationId, viewer.organizationId)))
      .limit(1);
   if (existing) return Response.json({ error: 'They are already a member' }, { status: 409 });

   try {
      const invitation = await auth.api.createInvitation({
         body: {
            email: address,
            role: role ?? 'member',
            organizationId: viewer.organizationId,
            ...(teamId ? { teamId } : {}),
         },
         headers: await headers(),
      });
      return Response.json({ id: invitation.id, email: address });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send the invitation';
      return Response.json({ error: message }, { status: 400 });
   }
}
