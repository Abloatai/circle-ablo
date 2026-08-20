import { expect, test } from '../helpers/fixtures';
import { settle } from '../helpers/ui';

/**
 * Creating an issue was reachable only through an unlabelled pencil icon.
 * These are the ways in that a person can actually find.
 */
test('the new issue button says what it is', async ({ alice, who }) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/team/${me.teamIds[0]}/all`);
   await settle(alice, 6000);
   await expect(alice.getByRole('button', { name: 'New issue' })).toContainText('New issue');
});

test('pressing C opens the new issue dialog', async ({ alice, who }) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/team/${me.teamIds[0]}/all`);
   await settle(alice, 6000);

   await alice.locator('body').press('c');
   await expect(alice.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
   await alice.keyboard.press('Escape');
   await settle(alice, 1500);

   // And it must not fire while typing, or a letter opens a dialog mid-word.
   await alice.locator('body').press('c');
   const dialog = alice.getByRole('dialog');
   await dialog.waitFor({ state: 'visible', timeout: 15_000 });
   const title = dialog.getByPlaceholder(/issue title/i).first();
   await title.click();
   await title.pressSequentially('abc', { delay: 20 });
   expect(await title.inputValue()).toBe('abc');
});
