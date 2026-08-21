import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { canManageWorkspace, getViewer } from '@/lib/session';

export async function DELETE(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });
   if (!canManageWorkspace(viewer)) {
      return Response.json({ error: 'Workspace admin access is required' }, { status: 403 });
   }
   const { installationId } = (await request.json()) as { installationId?: string };
   if (!installationId) {
      return Response.json({ error: 'installationId is required' }, { status: 400 });
   }
   await db
      .delete(t.githubInstallation)
      .where(
         and(
            eq(t.githubInstallation.id, installationId),
            eq(t.githubInstallation.organizationId, viewer.organizationId)
         )
      );
   return Response.json({ disconnected: true });
}
