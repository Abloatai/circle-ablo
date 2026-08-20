import { expect, test } from '../helpers/fixtures';
import { count, one, query } from '../helpers/db';
import { settle, type as typeInto } from '../helpers/ui';

/**
 * The control that matters.
 *
 * An earlier hand-written check "passed" by notifying someone who was already a
 * commenter on the issue — they would have been notified regardless, so it
 * proved nothing about subscriptions. This one subscribes a person with no
 * other connection to the issue and asserts they are reached.
 */
test('a subscriber with no other connection to an issue is notified', async ({ bob, who }) => {
   const [outsider, commenter] = who;

   const shared = commenter.teamIds[0];
   const issue = await one<{ id: string; identifier: string }>(
      `select i.id, i.identifier
         from issue i
        where i.team_id = $1
          and coalesce(i.assignee_id, '') <> $2
          and coalesce(i.created_by, '') <> $2
          and not exists (select 1 from comment c where c.issue_id = i.id and c.author_id = $2)
        order by i.created_at
        limit 1`,
      shared,
      outsider.id
   );
   expect(issue, 'no issue the outsider is uninvolved in').toBeTruthy();

   // Subscribe the outsider directly: the UI path is covered elsewhere, and
   // what is under test here is that a subscription causes a notification.
   await query(
      `insert into subscription (id, organization_id, ablo_tenant_id, user_id, entity_type, entity_id, created_at, updated_at)
       select $1, $2, (select ablo_tenant_id from issue limit 1), $3, 'issue', $4, now(), now()
       where not exists (select 1 from subscription where user_id = $3 and entity_type = 'issue' and entity_id = $4)`,
      `e2e-sub-${Date.now()}`,
      outsider.orgId,
      outsider.id,
      issue!.id
   );

   const before = await count(
      `select count(*)::int as n from notification where user_id = $1 and issue_id = $2 and type = 'comment'`,
      outsider.id,
      issue!.id
   );

   await bob.goto(`/${commenter.orgSlug}/issue/${issue!.identifier}`);
   await settle(bob, 8000);
   const box = bob.getByPlaceholder('Leave a comment…');
   await box.waitFor({ state: 'visible' });
   await typeInto(box, `subscription probe ${Date.now()}`);
   const submit = bob.getByRole('button', { name: /^Comment$/ });
   await expect(submit).toBeEnabled();
   await submit.click();
   await settle(bob, 7000);

   expect(
      await count(
         `select count(*)::int as n from notification where user_id = $1 and issue_id = $2 and type = 'comment'`,
         outsider.id,
         issue!.id
      )
   ).toBe(before + 1);

   await query(
      `delete from subscription where user_id = $1 and entity_type = 'issue' and entity_id = $2`,
      outsider.id,
      issue!.id
   );
});
