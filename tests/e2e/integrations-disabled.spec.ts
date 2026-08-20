import { expect, test } from '../helpers/fixtures';

/**
 * Integrations and Connected accounts are gated behind `INTEGRATIONS_ENABLED`.
 *
 * Neither connects to anything: the directory is a catalogue of pictures, and
 * Connected accounts listed a GitHub account named "octo-relay" with a
 * Connected badge — asserting a link that has never existed.
 *
 * Both halves are checked, because a disabled nav entry with a live URL is not
 * disabled and a dead URL with a live entry is a broken app.
 */
const GATED = ['/settings/integrations', '/settings/connected-accounts'];

test('the integrations settings are not reachable while they connect to nothing', async ({
   alice,
   who,
}) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/settings/preferences`);
   await alice.waitForTimeout(6000);

   for (const url of GATED) {
      expect(
         await alice.locator(`a[href$="${url}"]`).count(),
         `${url} is still a link in settings`
      ).toBe(0);
   }

   const disabled = alice.locator('[aria-disabled="true"]', { hasText: 'Integrations' }).first();
   await expect(disabled).toBeVisible();
   await expect(disabled).toHaveAttribute('title', /coming soon/i);

   for (const url of GATED) {
      await alice.goto(`/${me.orgSlug}${url}`);
      await alice.waitForTimeout(5000);
      expect(new URL(alice.url()).pathname, `${url} still serves a page`).not.toContain(url);
   }
});
