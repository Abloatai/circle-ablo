'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Retiring, restoring and deleting a team.
 *
 * Like leaving, these navigate with a full page load. Teams come from Better
 * Auth on the server, not over the sync stream, so the sidebar and the team
 * lists only change on a fresh document — and after a delete the browser must
 * drop the sync group it no longer belongs to.
 */
export function useTeamAdminActions() {
   const { organizationSlug } = useWorkspace();
   const [pending, setPending] = useState(false);

   const setArchived = useCallback(
      async (teamId: string, teamName: string, archived: boolean): Promise<boolean> => {
         setPending(true);
         try {
            const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}`, {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ archived }),
            });
            if (!response.ok) {
               const body = (await response.json().catch(() => ({}))) as { error?: string };
               toast.error(`Could not ${archived ? 'retire' : 'restore'} ${teamName}`, {
                  description: body.error,
               });
               return false;
            }
            window.location.reload();
            return true;
         } finally {
            setPending(false);
         }
      },
      []
   );

   const remove = useCallback(
      async (teamId: string, teamName: string, confirm: string): Promise<boolean> => {
         setPending(true);
         try {
            const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}`, {
               method: 'DELETE',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ confirm }),
            });
            const body = (await response.json().catch(() => ({}))) as {
               error?: string;
               issues?: number;
            };
            if (!response.ok) {
               toast.error(`Could not delete ${teamName}`, { description: body.error });
               return false;
            }
            window.location.href = `/${organizationSlug}`;
            return true;
         } finally {
            setPending(false);
         }
      },
      [organizationSlug]
   );

   return useMemo(() => ({ setArchived, remove, pending }), [setArchived, remove, pending]);
}
