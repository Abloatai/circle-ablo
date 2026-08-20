import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getViewer } from '@/lib/session';

/**
 * Removes the caller from a team.
 *
 * Better Auth has no "leave team". Its `removeTeamMember` requires the
 * `member: ["delete"]` permission, which an ordinary member does not have — so
 * a member could not remove *themselves*, which is the only case this is for.
 *
 * The user id comes from the session and is never read from the request, so
 * this endpoint cannot remove anyone else no matter what is posted to it. That
 * makes it narrower than the plugin's endpoint, not wider.
 *
 * Membership is Better Auth's data, written here through Drizzle — the same
 * deliberate exception to the Ablo write rule that the rest of identity uses.
 */
export async function POST(
   _request: Request,
   { params }: { params: Promise<{ teamId: string }> }
): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { teamId } = await params;

   // The team must be in the caller's organization; without this check a team
   // id from another workspace would be accepted and silently do nothing.
   const [team] = await db
      .select({ id: t.team.id })
      .from(t.team)
      .where(and(eq(t.team.id, teamId), eq(t.team.organizationId, viewer.organizationId)))
      .limit(1);
   if (!team) return Response.json({ error: 'No such team' }, { status: 404 });

   if (!viewer.teamIds.includes(teamId)) {
      return Response.json({ error: 'You are not a member of that team' }, { status: 400 });
   }

   await db
      .delete(t.teamMember)
      .where(and(eq(t.teamMember.teamId, teamId), eq(t.teamMember.userId, viewer.id)));

   return Response.json({ ok: true });
}
