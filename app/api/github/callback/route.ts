import { NextResponse } from 'next/server';
import { connectGitHubInstallation } from '@/lib/github/app';
import { verifyGitHubSetupState } from '@/lib/github/state';
import { canManageWorkspace, getViewer } from '@/lib/session';

const settingsUrl = (request: Request, slug: string, result: string) =>
   new URL(`/${slug}/settings/integrations?github=${encodeURIComponent(result)}`, request.url);

export async function GET(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return NextResponse.redirect(new URL('/sign-in', request.url));
   if (!canManageWorkspace(viewer)) {
      return NextResponse.redirect(settingsUrl(request, viewer.organizationSlug, 'forbidden'));
   }

   const url = new URL(request.url);
   const state = verifyGitHubSetupState(url.searchParams.get('state') ?? '');
   const installationId = Number(url.searchParams.get('installation_id'));
   if (
      !state ||
      state.organizationId !== viewer.organizationId ||
      state.userId !== viewer.id ||
      !Number.isSafeInteger(installationId)
   ) {
      return NextResponse.redirect(settingsUrl(request, viewer.organizationSlug, 'invalid-state'));
   }

   try {
      await connectGitHubInstallation({
         installationId,
         organizationId: viewer.organizationId,
         userId: viewer.id,
      });
      return NextResponse.redirect(settingsUrl(request, viewer.organizationSlug, 'connected'));
   } catch (error) {
      console.error('[github] installation callback failed', error);
      return NextResponse.redirect(settingsUrl(request, viewer.organizationSlug, 'failed'));
   }
}
