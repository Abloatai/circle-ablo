import { expect, test } from '../helpers/fixtures';
import { count, one } from '../helpers/db';
import { settle, type as typeInto } from '../helpers/ui';

/**
 * Creating an issue — the most basic write in the product, and the one this
 * suite was missing. Everything else tested a change to an issue that already
 * existed.
 *
 * The route allocates the identifier server-side so two people pressing create
 * at the same moment cannot land on the same number, then writes through Ablo.
 * So the assertions are: a row in Postgres, and the issue arriving in a second
 * tab that never reloads.
 */
test('creating an issue writes a row and reaches a second tab', async ({
   alice,
   secondTab,
   who,
}) => {
   const me = who[0];
   const landing = `/${me.orgSlug}/team/${me.teamIds[0]}/all`;
   await alice.goto(landing);
   await secondTab.goto(landing);
   await settle(alice, 7000);
   await settle(secondTab, 7000);

   const before = await count(
      `select count(*)::int as n from issue where team_id = $1`,
      me.teamIds[0]
   );

   const title = `e2e created ${Date.now()}`;

   // The trigger is icon-only in the sidebar header.
   await alice.getByRole('button', { name: 'New issue' }).click();
   const dialog = alice.getByRole('dialog');
   await dialog.waitFor({ state: 'visible', timeout: 20_000 });

   const titleBox = dialog.getByPlaceholder(/issue title/i).first();
   await titleBox.waitFor({ state: 'visible', timeout: 15_000 });
   await typeInto(titleBox, title);

   const submit = dialog.getByRole('button', { name: /create issue/i }).first();
   await expect(submit).toBeEnabled();
   await submit.click();
   await settle(alice, 8000);

   // Postgres is the evidence.
   const row = await one<{ identifier: string; team_id: string }>(
      `select identifier, team_id from issue where title = $1`,
      title
   );
   expect(row, 'no issue row was written').toBeTruthy();
   expect(row!.team_id).toBe(me.teamIds[0]);
   expect(
      await count(`select count(*)::int as n from issue where team_id = $1`, me.teamIds[0])
   ).toBe(before + 1);

   // And it arrives in the other tab without a reload.
   await settle(secondTab, 6000);
   await expect(secondTab.getByText(title).first()).toBeVisible();
});
