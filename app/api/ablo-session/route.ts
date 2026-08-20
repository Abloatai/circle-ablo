import { headers } from 'next/headers';
import {
   credentialEndpointErrorSchema,
   credentialEndpointSuccessSchema,
} from '@abloatai/ablo/auth';
import { identityAnchor, syncGroup } from '@abloatai/ablo/schema';
import { sync } from '@/ablo';
import { getViewer } from '@/lib/session';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * Mints the browser's Ablo credential.
 *
 * This is the seam between the two halves of the stack: Better Auth says who
 * the request is, and this route translates that into the sync groups they may
 * subscribe to. A participant never asks for its own scope — it gets the org
 * and the teams its membership implies, and nothing else.
 */
export async function POST(request: Request): Promise<Response> {
   if (!(await isSameOrigin(request))) {
      return Response.json(
         credentialEndpointErrorSchema.parse({
            error: { code: 'origin_mismatch', message: 'Cross-origin mint rejected' },
         }),
         { status: 403, headers: noStore }
      );
   }

   const viewer = await getViewer();
   if (!viewer) {
      return Response.json(
         credentialEndpointErrorSchema.parse({
            error: { code: 'session_expired', message: 'Sign in again' },
         }),
         { status: 401, headers: noStore }
      );
   }

   const { token, expiresAt } = await sync.sessions.create({
      user: { id: viewer.id },
      can: {
         issue: ['read', 'create', 'update', 'delete'],
         comment: ['read', 'create', 'update', 'delete'],
         issueActivity: ['read', 'create'],
         issueLink: ['read', 'create', 'delete'],
         issuePullRequest: ['read', 'create', 'update', 'delete'],
         project: ['read', 'create', 'update'],
         projectLabel: ['read', 'create', 'delete'],
         projectMilestone: ['read', 'create', 'update', 'delete'],
         projectUpdate: ['read', 'create'],
         projectResource: ['read', 'create', 'delete'],
         initiative: ['read', 'create', 'update', 'delete'],
         cycle: ['read', 'create', 'update', 'delete'],
         label: ['read', 'create', 'update', 'delete'],
         workflowState: ['read', 'create', 'update', 'delete'],
         document: ['read', 'create', 'update', 'delete'],
         documentFolder: ['read', 'create', 'update'],
         savedView: ['read', 'create', 'update', 'delete'],
         notification: ['read', 'create', 'update'],
         agentRun: ['read', 'create'],
         agentMessage: ['read', 'create'],
      },
      // `org` and `user` are kinds the engine reserves, so they get the typed
      // constructor — a misspelling is a compile error rather than a session
      // subscribed to nothing. `team` is this schema's own role, so it uses the
      // general form. A member always gets at least the first two: an empty
      // group list closes the session rather than widening it.
      syncGroups: [
         identityAnchor('org', viewer.organizationId),
         identityAnchor('user', viewer.id),
         ...viewer.teamIds.map((teamId) => syncGroup('team', teamId)),
      ],
   });

   return Response.json(
      credentialEndpointSuccessSchema.parse({ token, expiresAt, credentialKind: 'ephemeral' }),
      { headers: noStore }
   );
}

async function isSameOrigin(request: Request): Promise<boolean> {
   const origin = request.headers.get('origin');
   if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
   const host = (await headers()).get('host');
   return host !== null && new URL(origin).host === host;
}
