import { expect, test } from '../helpers/fixtures';
import { one } from '../helpers/db';
import { settle } from '../helpers/ui';

test('a member profile shows issues assigned with workspace-defined statuses', async ({
   alice,
   who,
}) => {
   const me = who[0];
   const assignment = await one<{ member_id: string; identifier: string }>(
      `select u.id as member_id, i.identifier
         from issue i
         join "user" u on u.id = i.assignee_id
         join member m on m.user_id = u.id and m.organization_id = i.organization_id
         join workflow_state ws on ws.id = i.status_id
        where i.organization_id = $1
          and ws.category not in ('completed', 'canceled')
        order by case when u.type = 'agent' then 0 else 1 end, i.created_at
        limit 1`,
      me.orgId
   );
   expect(assignment, 'the workspace has no active assigned issue').toBeTruthy();

   await alice.goto(`/${me.orgSlug}/profiles/${encodeURIComponent(assignment!.member_id)}`);
   await settle(alice, 7000);

   await expect(alice.getByText(assignment!.identifier, { exact: true })).toBeVisible();
});
