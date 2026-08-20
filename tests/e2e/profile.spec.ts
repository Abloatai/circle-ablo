import { expect, test } from '../helpers/fixtures';
import { one, query } from '../helpers/db';

/**
 * The profile fields were `defaultValue` inputs with no handler: they accepted
 * text and lost it. Identity is Better Auth's rather than Ablo's, so this does
 * not arrive in a second browser — a reload is the right test here, and it has
 * to be checked against Postgres because the value once saved correctly and
 * still came back empty (the loader dropped it on the way out).
 */
test('a profile field saves and survives a reload', async ({ alice, who }) => {
   const me = who[0];
   const original = await one<{ name: string; title: string | null }>(
      `select name, title from "user" where id = $1`,
      me.id
   );

   try {
      await alice.goto(`/${me.orgSlug}/settings/profile`);
      await alice.waitForTimeout(7000);

      const marker = `Staff Engineer ${Date.now().toString().slice(-5)}`;
      const title = alice.getByLabel('Title');
      await title.fill(marker);
      await title.blur();
      await alice.waitForTimeout(5000);

      expect(
         (await one<{ title: string }>(`select title from "user" where id = $1`, me.id))?.title
      ).toBe(marker);

      await alice.reload();
      await alice.waitForTimeout(7000);
      expect(await alice.getByLabel('Title').inputValue()).toBe(marker);
   } finally {
      await query(
         `update "user" set name = $1, title = $2 where id = $3`,
         original!.name,
         original!.title,
         me.id
      );
   }
});

test('the username field is not presented as editable', async ({ alice, who }) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/settings/profile`);
   await alice.waitForTimeout(6000);
   // Nothing resolves a handle, so it must not look like it saves one.
   await expect(alice.locator('input[readonly]')).toHaveCount(1);
});
