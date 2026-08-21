import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { canManageWorkspace, getViewer } from '@/lib/session';

export async function PATCH(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });
   if (!canManageWorkspace(viewer)) {
      return Response.json({ error: 'Workspace admin access is required' }, { status: 403 });
   }

   const body = (await request.json()) as {
      repositoryId?: string;
      teamId?: string | null;
      enabled?: boolean;
   };
   if (!body.repositoryId) {
      return Response.json({ error: 'repositoryId is required' }, { status: 400 });
   }

   if (body.teamId) {
      const [team] = await db
         .select({ id: t.team.id })
         .from(t.team)
         .where(and(eq(t.team.id, body.teamId), eq(t.team.organizationId, viewer.organizationId)))
         .limit(1);
      if (!team) {
         return Response.json({ error: 'That team is not in this workspace' }, { status: 400 });
      }
   }

   const [repository] = await db
      .select({ id: t.githubRepository.id })
      .from(t.githubRepository)
      .innerJoin(
         t.githubInstallation,
         eq(t.githubInstallation.id, t.githubRepository.installationId)
      )
      .where(
         and(
            eq(t.githubRepository.id, body.repositoryId),
            eq(t.githubInstallation.organizationId, viewer.organizationId)
         )
      )
      .limit(1);
   if (!repository) return Response.json({ error: 'Repository not found' }, { status: 404 });

   await db
      .update(t.githubRepository)
      .set({
         ...(body.teamId !== undefined ? { teamId: body.teamId } : {}),
         ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
         updatedAt: new Date(),
      })
      .where(eq(t.githubRepository.id, repository.id));
   return Response.json({ updated: true });
}
