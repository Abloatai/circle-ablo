import { expect, test } from '../helpers/fixtures';
import { count, query } from '../helpers/db';

/**
 * Leaving a team.
 *
 * Asserted against `team_member`, not the sidebar. The hand-written version of
 * this check passed while the membership was completely unchanged, because
 * Better Auth's `removeTeamMember` needs a permission an ordinary member does
 * not have — the sidebar had simply re-rendered.
 */
test('leaving a team removes the membership and keeps the workspace', async ({ alice, who }) => {
   const me = who[0];
   const teamId = `E2EL${Date.now().toString().slice(-6)}`;

   await query(
      `insert into team (id, name, organization_id, created_at, key)
       values ($1, $2, $3, now(), $1)`,
      teamId,
      `E2E Leave ${teamId}`,
      me.orgId
   );
   await query(
      `insert into team_member (id, team_id, user_id, created_at) values ($1, $2, $3, now())`,
      `tm_${teamId}`,
      teamId,
      me.id
   );

   try {
      expect(
         await count(
            `select count(*)::int as n from team_member where team_id = $1 and user_id = $2`,
            teamId,
            me.id
         )
      ).toBe(1);

      await alice.goto(`/${me.orgSlug}/settings/teams/${teamId}`);
      await alice.waitForTimeout(6000);
      await alice.getByRole('button', { name: /^Leave team\.\.\.$/ }).click();
      const dialog = alice.getByRole('alertdialog');
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: /^Leave team$/ }).click();
      await alice.waitForTimeout(9000);

      expect(
         await count(
            `select count(*)::int as n from team_member where team_id = $1 and user_id = $2`,
            teamId,
            me.id
         ),
         'the membership row is still there'
      ).toBe(0);

      expect(
         await count(`select count(*)::int as n from member where user_id = $1`, me.id),
         'leaving a team must not leave the workspace'
      ).toBe(1);
   } finally {
      await query(`delete from team_member where team_id = $1`, teamId);
      await query(`delete from team where id = $1`, teamId);
   }
});
