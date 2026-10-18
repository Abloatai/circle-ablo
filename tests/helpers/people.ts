import { getPool } from '@/db';
import { readAcceptanceMapping, loadAcceptancePeople } from '@/db/acceptance';

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
   if (!Number.isInteger(howMany) || howMany < 1 || howMany > 3) {
      throw new Error('Fixture supports one to three explicitly mapped people');
   }
   return (await loadAcceptancePeople(getPool(), readAcceptanceMapping())).slice(0, howMany);
}

/** Where a signed-in person lands, used to know a page has finished loading. */
export const isLoaded = (url: URL) => url.pathname.includes('/team/');
