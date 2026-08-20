import { expect, test } from '../helpers/fixtures';
import { one, query } from '../helpers/db';

/**
 * The Views page's workspace row showed a hardcoded "LN · LNDev UI ·
 * Workspace" in every workspace — badge and name both baked in from the
 * template this began as.
 *
 * The test renames the workspace before looking, because the seeded one is
 * *called* "LNDev UI": asserting that the page shows the database's name would
 * pass against the hardcoded string too, and prove nothing. Verified by
 * reintroducing the bug — this fails, the naive version did not.
 */
test('the Views page names the workspace you are actually in', async ({ alice, who }) => {
   const me = who[0];
   const org = await one<{ name: string }>(`select name from organization where id = $1`, me.orgId);
   expect(org?.name).toBeTruthy();

   const probe = `Probe Workspace ${Date.now().toString().slice(-5)}`;
   await query(`update organization set name = $1 where id = $2`, probe, me.orgId);

   try {
      await alice.goto(`/${me.orgSlug}/views`);
      await alice.waitForTimeout(7000);

      const row = alice.locator('text=· Workspace').locator('..');
      await expect(row, 'the workspace row does not carry the real name').toContainText(probe);
      await expect(row, 'the template name is still hardcoded').not.toContainText('LNDev UI');

      // The badge is derived from the name too, not a fixed "LN".
      await expect(row).toContainText(probe.slice(0, 2).toUpperCase());
   } finally {
      await query(`update organization set name = $1 where id = $2`, org!.name, me.orgId);
   }
});
