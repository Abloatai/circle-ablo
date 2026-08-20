import { expect, test } from '../helpers/fixtures';
import { count, one, query } from '../helpers/db';

/**
 * Retiring and deleting operate on a team created for the test.
 *
 * Nothing here touches a seeded team: deleting one clears eighteen tables, and
 * a suite that eats the fixtures is a suite you stop running.
 */
async function makeTeam(orgId: string, userId: string, suffix: string) {
   const id = `E2E${suffix}`;
   await query(
      `insert into team (id, name, organization_id, created_at, key)
       values ($1, $2, $3, now(), $1) on conflict (id) do nothing`,
      id,
      `E2E ${suffix}`,
      orgId
   );
   await query(
      `insert into team_member (id, team_id, user_id, created_at)
       values ($1, $2, $3, now()) on conflict (id) do nothing`,
      `tm_${id}_${userId}`,
      id,
      userId
   );
   return { id, name: `E2E ${suffix}` };
}

test('a retired team keeps its history and refuses new issues', async ({ alice, who }) => {
   const me = who[0];
   const team = await makeTeam(me.orgId, me.id, `R${Date.now().toString().slice(-6)}`);

   try {
      await alice.goto(`/${me.orgSlug}/settings/teams/${team.id}`);
      await alice.waitForTimeout(6000);
      await alice.getByRole('button', { name: /^Retire\.\.\.$/ }).click();
      const dialog = alice.getByRole('alertdialog');
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: /^Retire team$/ }).click();
      await alice.waitForTimeout(7000);

      const row = await one<{ archived_at: string | null }>(
         `select archived_at from team where id = $1`,
         team.id
      );
      expect(row?.archived_at, 'archived_at was not set').toBeTruthy();

      // The rule has to hold in the API, not only by hiding a button.
      const refused = await alice.evaluate(async (teamId) => {
         const response = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId, title: 'should be refused', statusId: 'x' }),
         });
         return { status: response.status, body: await response.text() };
      }, team.id);
      expect(refused.status).toBe(409);
      expect(refused.body).toContain('retired');
   } finally {
      await query(`delete from team_member where team_id = $1`, team.id);
      await query(`delete from team where id = $1`, team.id);
   }
});

test('deleting a team takes its data and nothing else', async ({ alice, who }) => {
   const me = who[0];
   const team = await makeTeam(me.orgId, me.id, `D${Date.now().toString().slice(-6)}`);

   const tenant = await one<{ ablo_tenant_id: string }>(`select ablo_tenant_id from issue limit 1`);
   const status = await one<{ id: string }>(`select id from workflow_state limit 1`);
   await query(
      `insert into issue (id, organization_id, ablo_tenant_id, team_id, identifier, title, status_id, priority, rank, created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, 'Doomed', $6, 0, 'a', $7, now(), now())`,
      `${team.id}-issue`,
      me.orgId,
      tenant!.ablo_tenant_id,
      team.id,
      `${team.id}-1`,
      status!.id,
      me.id
   );

   const neighbours = await count(
      `select count(*)::int as n from team where organization_id = $1 and id <> $2`,
      me.orgId,
      team.id
   );

   await alice.goto(`/${me.orgSlug}/settings/teams/${team.id}`);
   await alice.waitForTimeout(6000);
   await alice.getByRole('button', { name: /^Delete\.\.\.$/ }).click();
   const dialog = alice.getByRole('alertdialog');
   await dialog.waitFor({ state: 'visible' });

   const confirm = dialog.getByRole('button', { name: /^Delete team$/ });
   await expect(confirm, 'delete must be gated on typing the name').toBeDisabled();
   await dialog.locator('input').fill(team.name);
   await expect(confirm).toBeEnabled();
   await confirm.click();
   await alice.waitForTimeout(10_000);

   expect(await count(`select count(*)::int as n from team where id = $1`, team.id)).toBe(0);
   expect(await count(`select count(*)::int as n from issue where team_id = $1`, team.id)).toBe(0);
   expect(
      await count(`select count(*)::int as n from team_member where team_id = $1`, team.id)
   ).toBe(0);
   expect(
      await count(
         `select count(*)::int as n from team where organization_id = $1 and id <> $2`,
         me.orgId,
         team.id
      ),
      'neighbouring teams were affected'
   ).toBe(neighbours);
});
