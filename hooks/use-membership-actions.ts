'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Leaving a team or a workspace.
 *
 * Membership is Better Auth's, not Ablo's — one of the deliberate exceptions to
 * the write rule, because identity is not workspace data. `organization`,
 * `member`, `team` and `teamMember` are the plugin's tables.
 *
 * **The navigation afterwards is a full page load on purpose.** An Ablo session
 * is minted with the sync groups the person's membership implies, and those are
 * fixed for the life of the session. A client-side `router.push` would leave the
 * browser subscribed to a team it has just left, still receiving its rows. Only
 * a fresh document mints a fresh session.
 */
export function useMembershipActions() {
   const { organizationId, organizationSlug } = useWorkspace();
   const [pending, setPending] = useState(false);

   const leaveTeam = useCallback(
      async (teamId: string, teamName: string): Promise<boolean> => {
         setPending(true);
         try {
            // Not Better Auth's removeTeamMember: that requires the
            // `member: ["delete"]` permission, so an ordinary member cannot
            // remove themselves — the only case this is for. The route takes
            // the user from the session, never from the request.
            const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/leave`, {
               method: 'POST',
            });
            if (!response.ok) {
               const body = (await response.json().catch(() => ({}))) as { error?: string };
               toast.error(`Could not leave ${teamName}`, { description: body.error });
               return false;
            }
            // Re-mint: this browser must stop receiving the team's rows.
            window.location.href = `/${organizationSlug}`;
            return true;
         } catch (error) {
            toast.error(`Could not leave ${teamName}`, {
               description: error instanceof Error ? error.message : undefined,
            });
            return false;
         } finally {
            setPending(false);
         }
      },
      [organizationSlug]
   );

   const leaveWorkspace = useCallback(async (): Promise<boolean> => {
      setPending(true);
      try {
         const { error } = await authClient.organization.leave({ organizationId });
         if (error) {
            // Better Auth refuses when you are the only owner, which is the
            // right answer — a workspace with no owner cannot be administered.
            toast.error('Could not leave the workspace', { description: error.message });
            return false;
         }
         window.location.href = '/';
         return true;
      } catch (error) {
         toast.error('Could not leave the workspace', {
            description: error instanceof Error ? error.message : undefined,
         });
         return false;
      } finally {
         setPending(false);
      }
   }, [organizationId]);

   return useMemo(
      () => ({ leaveTeam, leaveWorkspace, pending }),
      [leaveTeam, leaveWorkspace, pending]
   );
}
