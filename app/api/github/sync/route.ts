import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { syncGitHubRepositories } from '@/lib/github/app';
import { canManageWorkspace, getViewer } from '@/lib/session';

export async function POST(): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });
   if (!canManageWorkspace(viewer)) {
      return Response.json({ error: 'Workspace admin access is required' }, { status: 403 });
   }

   const installations = await db
      .select()
      .from(t.githubInstallation)
      .where(eq(t.githubInstallation.organizationId, viewer.organizationId));
   const counts = await Promise.all(
      installations.map((installation) =>
         syncGitHubRepositories(installation.id, installation.installationId, viewer.organizationId)
      )
   );
   return Response.json({ repositories: counts.reduce((sum, count) => sum + count, 0) });
}
