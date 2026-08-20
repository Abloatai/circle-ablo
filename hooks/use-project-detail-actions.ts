'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * Writes to a project's milestones and linked resources.
 *
 * Both are team-scoped and hang off the project, so the team comes from the
 * project rather than from the row — a milestone filed under a team the viewer
 * is not in would be a row they immediately cannot see.
 */
export function useProjectDetailActions(projectId: string, teamId: string) {
   const ablo = useAblo();
   const { organizationId } = useWorkspace();

   return useMemo(
      () => ({
         addMilestone: async (name: string, position: number, targetDate?: string) => {
            if (!ablo) return;
            try {
               await ablo.projectMilestone.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     teamId,
                     projectId,
                     name: name.trim() || 'New milestone',
                     done: false,
                     position,
                     ...(targetDate ? { targetDate } : {}),
                  },
               });
            } catch (error) {
               toast.error('Could not add the milestone', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         setMilestoneDone: async (id: string, done: boolean) => {
            if (!ablo) return;
            try {
               await ablo.projectMilestone.update({ id, data: { done } });
            } catch (error) {
               toast.error('Could not update the milestone', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         setMilestoneName: async (id: string, name: string) => {
            if (!ablo) return;
            try {
               await ablo.projectMilestone.update({ id, data: { name } });
            } catch (error) {
               toast.error('Could not rename the milestone', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         removeMilestone: async (id: string, name: string) => {
            if (!ablo) return;
            try {
               await ablo.projectMilestone.delete({ id });
               toast.success(`${name} removed`);
            } catch (error) {
               toast.error('Could not remove the milestone', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         addResource: async (title: string, url: string) => {
            if (!ablo) return;
            try {
               await ablo.projectResource.create({
                  data: {
                     id: crypto.randomUUID(),
                     workspaceId: organizationId,
                     teamId,
                     projectId,
                     title: title.trim() || url,
                     url: url.trim(),
                  },
               });
            } catch (error) {
               toast.error('Could not add the link', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },

         removeResource: async (id: string, label: string) => {
            if (!ablo) return;
            try {
               await ablo.projectResource.delete({ id });
               toast.success(`${label} removed`);
            } catch (error) {
               toast.error('Could not remove the link', {
                  description: error instanceof Error ? error.message : undefined,
               });
            }
         },
      }),
      [ablo, organizationId, projectId, teamId]
   );
}
