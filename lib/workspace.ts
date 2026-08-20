import { headers } from 'next/headers';
import { sync } from '@/ablo';
import { db } from '@/db';
import * as t from '@/db/schema';
import { auth } from '@/lib/auth';
import { labels as defaultLabels } from '@/lib/domain/labels';
import { status as defaultStatuses } from '@/lib/domain/status';

/**
 * Creates a workspace for someone who just signed up.
 *
 * A new organization is not usable until it has a workflow: an issue points at
 * a status id, so an org with no statuses can hold no issues. The default set
 * is the same one the UI already knows how to render, which is why it is read
 * from lib/domain rather than re-invented here.
 */
export async function createWorkspace(input: {
   userId: string;
   organizationName: string;
   slug: string;
   teamName: string;
   teamKey: string;
}): Promise<{ slug: string; teamKey: string }> {
   const requestHeaders = await headers();
   const teamKey = input.teamKey.toUpperCase();

   const organization = await auth.api.createOrganization({
      body: { name: input.organizationName, slug: input.slug, userId: input.userId },
      headers: requestHeaders,
   });
   if (!organization) throw new Error('Could not create the workspace');

   const team = await auth.api.createTeam({
      body: { name: input.teamName, organizationId: organization.id, key: teamKey },
      headers: requestHeaders,
   });

   await auth.api.addTeamMember({
      body: { teamId: team.id, userId: input.userId },
      headers: requestHeaders,
   });

   /**
    * The workflow and labels a new workspace cannot function without.
    *
    * These are written straight to Postgres — but **with Ablo's tenancy column
    * stamped**, which is the part that was missing and the reason a new
    * workspace was unusable. A row without it can never be routed to any
    * client: it lands, it is queryable in SQL, and the sync layer cannot see
    * it. So a new member got statuses that did not exist as far as the app was
    * concerned, and could not create an issue at all — an issue needs a
    * `statusId` and the picker was empty. Nothing errored, because the rows
    * were right there in the database.
    *
    * Writing them through Ablo instead would also be correct and is what the
    * rest of the app does, but it is 24 sequential round trips — measured at
    * roughly 1.6s each, so about 40 seconds of someone staring at a spinner on
    * their first ever screen. A stamped bulk insert is one query, and the rows
    * reach connected clients over replication about a second later; verified,
    * no resnapshot involved. The resnapshot `db/seed.ts` chains is for rows
    * that predate the connection, which these do not.
    *
    * The value comes from the credential rather than an env var, because a
    * forgotten variable here is invisible in exactly the way this bug was.
    */
   await sync.ready();
   const abloTenantId = sync.identity?.organizationId;
   if (!abloTenantId) throw new Error('Could not resolve the Ablo tenant id from ABLO_API_KEY');

   const base = {
      organizationId: organization.id,
      abloTenantId,
      createdBy: input.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
   };

   await db.insert(t.workflowState).values(
      defaultStatuses.map((status, index) => ({
         ...base,
         id: `${organization.id}_${status.id}`,
         name: status.name,
         color: status.color,
         category: status.category,
         position: index,
      }))
   );

   await db.insert(t.label).values(
      defaultLabels.map((label) => ({
         ...base,
         id: `${organization.id}_${label.id}`,
         name: label.name,
         color: label.color,
      }))
   );

   await auth.api.setActiveOrganization({
      body: { organizationId: organization.id },
      headers: requestHeaders,
   });

   return { slug: input.slug, teamKey };
}

/** Turns a workspace name into a URL-safe slug. */
export function slugify(value: string): string {
   return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
}
