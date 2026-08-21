import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { syncGitHubRepositories } from '@/lib/github/app';
import { getGitHubAppConfig } from '@/lib/github/config';
import { verifyGitHubWebhookSignature } from '@/lib/github/webhook-signature';

export async function POST(request: Request): Promise<Response> {
   const body = await request.text();
   if (
      !verifyGitHubWebhookSignature(
         body,
         request.headers.get('x-hub-signature-256'),
         getGitHubAppConfig().webhookSecret
      )
   ) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
   }
   const deliveryId = request.headers.get('x-github-delivery');
   const event = request.headers.get('x-github-event');
   if (!deliveryId || !event) {
      return Response.json({ error: 'Missing delivery headers' }, { status: 400 });
   }

   const inserted = await db
      .insert(t.githubWebhookDelivery)
      .values({ id: deliveryId, event })
      .onConflictDoNothing()
      .returning({ id: t.githubWebhookDelivery.id });
   if (!inserted.length) return Response.json({ duplicate: true });

   try {
      const payload = JSON.parse(body) as {
         action?: string;
         installation?: { id: number; suspended_at?: string | null };
         repository?: { full_name?: string };
         pull_request?: {
            html_url: string;
            title: string;
            state: string;
            draft: boolean;
            merged_at: string | null;
         };
      };
      const installationId = payload.installation?.id;
      const [installation] = installationId
         ? await db
              .select()
              .from(t.githubInstallation)
              .where(eq(t.githubInstallation.installationId, installationId))
              .limit(1)
         : [];

      if (event === 'installation' && installation) {
         if (payload.action === 'deleted') {
            await db
               .delete(t.githubInstallation)
               .where(eq(t.githubInstallation.id, installation.id));
         } else {
            const suspendedAt = payload.installation?.suspended_at
               ? new Date(payload.installation.suspended_at)
               : null;
            await db
               .update(t.githubInstallation)
               .set({
                  suspendedAt,
                  updatedAt: new Date(),
               })
               .where(eq(t.githubInstallation.id, installation.id));
            // GitHub rejects installation tokens while suspended. Unsuspending
            // and permission changes should refresh the repository allowlist.
            if (!suspendedAt) {
               await syncGitHubRepositories(
                  installation.id,
                  installation.installationId,
                  installation.organizationId
               );
            }
         }
      }

      if (event === 'installation_repositories' && installation) {
         await syncGitHubRepositories(
            installation.id,
            installation.installationId,
            installation.organizationId
         );
      }

      if (
         event === 'pull_request' &&
         installation &&
         payload.repository?.full_name &&
         payload.pull_request
      ) {
         const [repository] = await db
            .select({ teamId: t.githubRepository.teamId })
            .from(t.githubRepository)
            .where(
               and(
                  eq(t.githubRepository.installationId, installation.id),
                  eq(t.githubRepository.enabled, true),
                  eq(
                     sql`lower(${t.githubRepository.fullName})`,
                     payload.repository.full_name.toLowerCase()
                  )
               )
            )
            .limit(1);
         if (!repository?.teamId) return Response.json({ accepted: true });

         const state = payload.pull_request.merged_at
            ? 'merged'
            : payload.pull_request.draft
              ? 'draft'
              : payload.pull_request.state === 'closed'
                ? 'closed'
                : 'open';
         await db
            .update(t.issuePullRequest)
            .set({ title: payload.pull_request.title, state, updatedAt: new Date() })
            .where(
               and(
                  eq(t.issuePullRequest.organizationId, installation.organizationId),
                  eq(t.issuePullRequest.teamId, repository.teamId),
                  eq(t.issuePullRequest.url, payload.pull_request.html_url)
               )
            );
      }

      return Response.json({ accepted: true });
   } catch (error) {
      await db.delete(t.githubWebhookDelivery).where(eq(t.githubWebhookDelivery.id, deliveryId));
      console.error('[github] webhook failed', error);
      return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
   }
}
