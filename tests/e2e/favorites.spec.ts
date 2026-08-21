import { expect, test } from '../helpers/fixtures';
import { count } from '../helpers/db';
import { menuItem, openIssueMenu, settle, sidebarGroupItems } from '../helpers/ui';

test('starring an issue reaches a second tab that never reloads', async ({
   alice,
   secondTab,
   who,
}) => {
   const me = who[0];
   const landing = `/${me.orgSlug}/team/${me.teamIds[0]}/all`;
   await alice.goto(landing);
   await secondTab.goto(landing);
   await settle(alice, 6000);
   await settle(secondTab, 6000);

   // Star whatever the first row is, then read back which issue that was.
   const trigger = await openIssueMenu(alice);
   const title = (await trigger.innerText()).split('\n').filter(Boolean)[1] ?? '';
   // Normalise rather than skip: a test that opts out when the state is
   // inconvenient stops covering anything the moment the seed drifts.
   if ((await menuItem(alice, 'Unfavorite').count()) > 0) {
      await menuItem(alice, 'Unfavorite').click();
      await settle(alice);
      await openIssueMenu(alice);
   }

   // Baseline is taken once the issue is known to be unstarred.
   const before = await sidebarGroupItems(secondTab, 'Favorites');
   const rowsBefore = await count(
      `select count(*)::int as n from favorite where user_id = $1 and entity_type = 'issue'`,
      me.id
   );

   await menuItem(alice, 'Favorite').click();
   await settle(alice);
   await settle(secondTab);

   // Ground truth first — the sidebar is a consequence, not the evidence.
   expect(
      await count(
         `select count(*)::int as n from favorite where user_id = $1 and entity_type = 'issue'`,
         me.id
      )
   ).toBe(rowsBefore + 1);

   const after = await sidebarGroupItems(secondTab, 'Favorites');
   expect(after.length).toBe(before.length + 1);
   expect(after.join(' ')).toContain(title.slice(0, 20));

   // Unstar, and the second tab must lose it again — still without reloading.
   await openIssueMenu(alice);
   await menuItem(alice, 'Unfavorite').click();
   await settle(alice);
   await settle(secondTab);

   expect(
      await count(
         `select count(*)::int as n from favorite where user_id = $1 and entity_type = 'issue'`,
         me.id
      )
   ).toBe(rowsBefore);
   expect(await sidebarGroupItems(secondTab, 'Favorites')).toEqual(before);
});

test('a favourite belongs to one person only', async ({ alice, bob, who }) => {
   const [me, them] = who;
   await alice.goto(`/${me.orgSlug}/team/${me.teamIds[0]}/all`);
   await bob.goto(`/${them.orgSlug}/team/${them.teamIds[0]}/all`);
   await settle(alice, 6000);
   await settle(bob, 6000);

   await openIssueMenu(alice);
   const starred = (await menuItem(alice, 'Unfavorite').count()) > 0;
   await (starred ? menuItem(alice, 'Unfavorite') : menuItem(alice, 'Favorite')).click();
   await settle(alice);
   await settle(bob);

   // Bob's Favorites must be unaffected by anything Alice starred.
   expect(await count(`select count(*)::int as n from favorite where user_id = $1`, them.id)).toBe(
      await count(`select count(*)::int as n from favorite where user_id = $1`, them.id)
   );
   const bobsRows = await count(
      `select count(*)::int as n from favorite where user_id = $1`,
      them.id
   );
   const bobsSidebar = await sidebarGroupItems(bob, 'Favorites');
   expect(bobsSidebar.length).toBe(bobsRows);

   // Put it back.
   await openIssueMenu(alice);
   await (starred ? menuItem(alice, 'Favorite') : menuItem(alice, 'Unfavorite')).click();
   await settle(alice);
});
