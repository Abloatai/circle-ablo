import { expect, test } from '../helpers/fixtures';

/**
 * Reviews is gated behind `REVIEWS_ENABLED` because it renders from a fixture.
 *
 * Both halves matter: a disabled link with a live URL is not disabled, and a
 * dead URL with a live link is a broken app. This fails the moment either half
 * is switched on without the other.
 */
test('the Reviews section is not reachable while it is a fixture', async ({ alice, who }) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/team/${me.teamIds[0]}/all`);
   await alice.waitForTimeout(6000);

   // The sidebar entry is present but not a link, and says why on hover.
   const entry = alice.locator('[aria-disabled="true"]', { hasText: 'Reviews' }).first();
   await expect(entry).toBeVisible();
   await expect(entry).toHaveAttribute('title', /coming soon/i);
   expect(
      await alice.locator('a[href$="/reviews"]').count(),
      'Reviews is still a link in the sidebar'
   ).toBe(0);

   // And the URL itself does not resolve. `app/not-found.tsx` redirects to the
   // root rather than rendering a 404 page, so the evidence is where you end up
   // — not the status code, which is 200 after the redirect is followed.
   await alice.goto(`/${me.orgSlug}/reviews`);
   await alice.waitForTimeout(5000);
   expect(new URL(alice.url()).pathname, '/reviews still serves the section').not.toContain(
      '/reviews'
   );

   await alice.goto(`/${me.orgSlug}/review/anything`);
   await alice.waitForTimeout(5000);
   expect(new URL(alice.url()).pathname, '/review/:id still serves the section').not.toContain(
      '/review/'
   );
});
