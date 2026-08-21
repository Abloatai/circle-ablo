import { NextResponse } from 'next/server';
import { getGitHubAppConfig } from '@/lib/github/config';
import { createGitHubSetupState } from '@/lib/github/state';
import { canManageWorkspace, getViewer } from '@/lib/session';

export async function GET(): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });
   if (!canManageWorkspace(viewer)) {
      return Response.json({ error: 'Workspace admin access is required' }, { status: 403 });
   }

   let config;
   try {
      config = getGitHubAppConfig();
   } catch (error) {
      return Response.json(
         { error: error instanceof Error ? error.message : 'GitHub App is not configured' },
         { status: 503 }
      );
   }

   const state = createGitHubSetupState(viewer.organizationId, viewer.id);
   return NextResponse.redirect(
      `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new?state=${encodeURIComponent(state)}`
   );
}
