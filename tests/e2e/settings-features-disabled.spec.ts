import { expect, test } from '../helpers/fixtures';
import { settle } from '../helpers/ui';

const FEATURES = [
   'AI & Agents',
   'Initiatives',
   'Documents',
   'Customer requests',
   'Releases',
   'Pulse',
   'Asks',
   'Emojis',
   'Integrations',
];

const DISABLED_PERSONAL = ['Code & reviews', 'Agent personalization'];

test('unavailable Settings entries are disabled', async ({ alice, who }) => {
   await alice.goto(`/${who[0].orgSlug}/settings/preferences`);
   await settle(alice, 6000);

   const group = alice.locator('[data-sidebar="group"]', { hasText: 'Features' });
   await expect(group).toBeVisible();

   for (const name of FEATURES) {
      const entry = group.locator('[aria-disabled="true"]', { hasText: name }).first();
      await expect(entry).toBeVisible();
      await expect(entry).toHaveAttribute('title', /coming soon/i);
      await expect(entry.getByRole('button', { name })).toBeDisabled();
   }

   await expect(group.getByRole('link')).toHaveCount(0);

   const personal = alice.locator('[data-sidebar="group"]', { hasText: 'Personal' });
   for (const name of DISABLED_PERSONAL) {
      const entry = personal.locator('[aria-disabled="true"]', { hasText: name }).first();
      await expect(entry).toHaveAttribute('title', /coming soon/i);
      await expect(entry.getByRole('button', { name })).toBeDisabled();
   }
});
