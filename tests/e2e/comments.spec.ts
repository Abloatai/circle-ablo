import { expect, test } from '../helpers/fixtures';
import { count, one } from '../helpers/db';
import { settle, type as typeInto } from '../helpers/ui';

/**
 * A comment is the write path in miniature: it must reach Postgres, reach
 * another person's browser without a reload, and notify the people concerned.
 */
test('a comment reaches Postgres and a second browser that never reloads', async ({
   alice,
   bob,
   who,
}) => {
   const [me, them] = who;

   // An issue both people can see: pick one on a team they share.
   const shared = me.teamIds.find((id) => them.teamIds.includes(id));
   expect(shared, 'the two test people share no team').toBeTruthy();

   const issue = await one<{ id: string; identifier: string }>(
      `select id, identifier from issue where team_id = $1 order by created_at limit 1`,
      shared
   );
   expect(issue, 'no issue on the shared team').toBeTruthy();

   const url = `/${me.orgSlug}/issue/${issue!.identifier}`;
   await alice.goto(url);
   await bob.goto(url);
   await settle(alice, 7000);
   await settle(bob, 7000);

   const marker = `e2e comment ${Date.now()}`;
   const box = alice.getByPlaceholder('Leave a comment…');
   await box.waitFor({ state: 'visible' });
   await typeInto(box, marker);

   const submit = alice.getByRole('button', { name: /^Comment$/ });
   await expect(submit).toBeEnabled();
   await submit.click();
   await settle(alice, 6000);

   // Postgres first.
   expect(
      await count(`select count(*)::int as n from comment where body like $1`, `%${marker}%`)
   ).toBe(1);

   // Then the other browser, which has not reloaded.
   await settle(bob, 4000);
   await expect(bob.getByText(marker)).toBeVisible();
});
