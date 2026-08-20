import { expect, test } from '../helpers/fixtures';
import { one, query } from '../helpers/db';
import { settle } from '../helpers/ui';

/**
 * The team overview rendered fixture documents, a description that was the
 * literal string "Add a description…", two buttons with no handler, and a
 * "Views" link pointing at `#`. It also fell back to `teams[0]`, so an unknown
 * team id showed a different team's name and members under this team's URL.
 */
test('the team overview is the team you asked for, and its description saves', async ({
   alice,
   who,
}) => {
   const me = who[0];
   const teamId = me.teamIds[0];
   const before = await one<{ description: string | null; name: string }>(
      `select description, name from team where id = $1`,
      teamId
   );

   try {
      await alice.goto(`/${me.orgSlug}/team/${teamId}/overview`);
      await settle(alice, 7000);

      await expect(alice.getByRole('heading', { name: before!.name })).toBeVisible();

      const marker = `What this team works on ${Date.now().toString().slice(-5)}`;
      await alice
         .getByRole('button', { name: /add a description|What this team works on/i })
         .first()
         .click();
      const box = alice.getByLabel('Team description');
      await box.waitFor({ state: 'visible' });
      await box.fill(marker);
      await box.blur();
      await settle(alice, 5000);

      expect(
         (await one<{ description: string }>(`select description from team where id = $1`, teamId))
            ?.description,
         'the description did not reach Postgres'
      ).toBe(marker);

      await alice.reload();
      await settle(alice, 7000);
      await expect(alice.getByText(marker)).toBeVisible();

      // Every "Go to" link points somewhere real.
      const deadLinks = await alice.locator('a[href="#"]').count();
      expect(deadLinks, 'the overview still has a link to nowhere').toBe(0);
   } finally {
      await query(`update team set description = $1 where id = $2`, before!.description, teamId);
   }
});

test('an unknown team says so rather than showing another team', async ({ alice, who }) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/team/NOSUCHTEAM/overview`);
   await settle(alice, 6000);
   await expect(alice.getByText('Team not found')).toBeVisible();
});
