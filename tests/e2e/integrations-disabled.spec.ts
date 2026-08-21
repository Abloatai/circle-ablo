import { expect, test } from '../helpers/fixtures';

test('GitHub integrations are reachable while fake connected accounts stay disabled', async ({
   alice,
   who,
}) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/settings/preferences`);
   await alice.waitForTimeout(6000);

   await expect(alice.getByRole('link', { name: 'Integrations' })).toHaveAttribute(
      'href',
      `/${me.orgSlug}/settings/integrations`
   );
   const connectedAccounts = alice
      .locator('[aria-disabled="true"]', { hasText: 'Connected accounts' })
      .first();
   await expect(connectedAccounts).toHaveAttribute('title', /coming soon/i);

   await alice.goto(`/${me.orgSlug}/settings/integrations`);
   await expect(alice.getByRole('heading', { name: 'Integrations' })).toBeVisible();

   await alice.goto(`/${me.orgSlug}/settings/connected-accounts`);
   await alice.waitForTimeout(5000);
   expect(new URL(alice.url()).pathname).not.toContain('/settings/connected-accounts');
});
