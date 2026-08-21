import { expect, test } from '../helpers/fixtures';
import { one, query } from '../helpers/db';
import { settle } from '../helpers/ui';

test('people and agents can be assigned from inside an issue', async ({ alice, who }) => {
   const [me] = who;
   const teamId = me.teamIds[0];
   expect(teamId, 'the test person is not on a team').toBeTruthy();

   const issue = await one<{ id: string; identifier: string; assignee_id: string | null }>(
      `select id, identifier, assignee_id
         from issue
        where team_id = $1
        order by created_at
        limit 1`,
      teamId
   );
   expect(issue, 'the team has no issue to assign').toBeTruthy();

   const person = await one<{ id: string; name: string }>(
      `select u.id, u.name
         from "user" u
         join team_member tm on tm.user_id = u.id
        where tm.team_id = $1
          and coalesce(u.type, 'human') = 'human'
          and u.id <> coalesce($2, '')
        order by u.id
        limit 1`,
      teamId,
      issue!.assignee_id
   );
   const agent = await one<{ id: string; name: string }>(
      `select u.id, u.name
         from "user" u
         join team_member tm on tm.user_id = u.id
        where tm.team_id = $1 and u.type = 'agent'
        order by u.id
        limit 1`,
      teamId
   );
   expect(person, 'the team has no alternative person').toBeTruthy();
   expect(agent, 'the team has no agent').toBeTruthy();

   let dispatchedAgentId: string | undefined;
   await alice.route('**/api/agent/dispatch', async (route) => {
      const payload = route.request().postDataJSON() as { agentUserId?: string };
      dispatchedAgentId = payload.agentUserId;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
   });

   try {
      await alice.goto(`/${me.orgSlug}/issue/${issue!.identifier}`);
      await settle(alice, 7000);

      const panel = alice.locator('aside').filter({ hasText: 'Properties' });
      const picker = panel.getByRole('button', { name: /Change assignee/ });

      await picker.click();
      await alice.getByRole('menuitem').filter({ hasText: person!.name }).click();
      await expect
         .poll(
            async () =>
               (
                  await one<{ assignee_id: string | null }>(
                     `select assignee_id from issue where id = $1`,
                     issue!.id
                  )
               )?.assignee_id
         )
         .toBe(person!.id);

      await picker.click();
      await alice.getByRole('menuitem').filter({ hasText: agent!.name }).click();
      await expect
         .poll(
            async () =>
               (
                  await one<{ assignee_id: string | null }>(
                     `select assignee_id from issue where id = $1`,
                     issue!.id
                  )
               )?.assignee_id
         )
         .toBe(agent!.id);
      await expect.poll(() => dispatchedAgentId).toBe(agent!.id);
   } finally {
      await query(`update issue set assignee_id = $1 where id = $2`, issue!.assignee_id, issue!.id);
   }
});
