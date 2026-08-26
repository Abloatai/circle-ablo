import { expect, test } from '../helpers/fixtures';
import { settle } from '../helpers/ui';

test('Reviews is reachable and uses an honest empty state without connected repositories', async ({
   alice,
   who,
}) => {
   const me = who[0];
   await alice.goto(`/${me.orgSlug}/team/${me.teamIds[0]}/all`);
   await settle(alice, 6000);

   const reviews = alice.getByRole('link', { name: 'Reviews' }).first();
   await expect(reviews).toHaveAttribute('href', `/${me.orgSlug}/reviews`);

   await reviews.click();
   await expect(alice).toHaveURL(new RegExp(`/${me.orgSlug}/reviews$`));
   await expect(alice.getByText('No GitHub repositories are mapped to your teams.')).toBeVisible();
   await expect(alice.getByRole('link', { name: 'Configure GitHub integration' })).toHaveAttribute(
      'href',
      `/${me.orgSlug}/settings/integrations`
   );
});
