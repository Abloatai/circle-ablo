import { one, query } from './db';

export interface TestPerson {
   id: string;
   name: string;
   email: string;
   orgId: string;
   orgSlug: string;
   teamIds: string[];
}

/**
 * Who the tests sign in as.
 *
 * Resolved from the database rather than hardcoded. The fixture emails in
 * `lib/domain/users.ts` have changed at least once while a seeded database kept
 * the old ones, and a suite that hardcodes them fails for a reason that has
 * nothing to do with the code under test.
 */
export async function findPeople(howMany: number): Promise<TestPerson[]> {
   const org = await one<{ id: string; slug: string }>(
      `select id, slug from organization order by created_at limit 1`
   );
   if (!org) throw new Error('No organization found — run `pnpm db:seed` first.');

   const rows = await query<{ id: string; name: string; email: string }>(
      `select u.id, u.name, u.email
         from "user" u
         join member m on m.user_id = u.id
         join account a on a.user_id = u.id
        where m.organization_id = $1 and coalesce(u.type, 'human') = 'human'
        order by u.id
        limit $2`,
      org.id,
      howMany
   );
   if (rows.length < howMany) {
      throw new Error(
         `Need ${howMany} seeded people with credentials; found ${rows.length}. Run \`pnpm db:seed\`.`
      );
   }

   return Promise.all(
      rows.map(async (row) => ({
         ...row,
         orgId: org.id,
         orgSlug: org.slug,
         teamIds: (
            await query<{ team_id: string }>(
               `select tm.team_id from team_member tm
                  join team t on t.id = tm.team_id
                 where tm.user_id = $1 and t.organization_id = $2 and t.archived_at is null`,
               row.id,
               org.id
            )
         ).map((t) => t.team_id),
      }))
   );
}

/** Where a signed-in person lands, used to know a page has finished loading. */
export const isLoaded = (url: URL) => url.pathname.includes('/team/');
