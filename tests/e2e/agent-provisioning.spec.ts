import { expect, test } from '../helpers/fixtures';
import { one, query } from '../helpers/db';
import { settle } from '../helpers/ui';

/**
 * Every workspace gets an agent.
 *
 * Handing an issue to an agent is an ordinary assignment — the picker lists it
 * beside the people — so a workspace with no agent user cannot reach the
 * feature at all. Only `db/seed.ts` used to create one, which put the headline
 * capability of the product in the demo data and nowhere else: signing up got
 * you a workspace where it was simply absent.
 *
 * This signs up for real rather than calling the provisioning function, because
 * the bug was that the sign-up path did not call it.
 */
test('signing up creates a workspace with an agent in it', async ({ browser }) => {
   const stamp = Date.now().toString().slice(-9);
   const email = `probe-${stamp}@example.invalid`;
   const context = await browser.newContext();
   const page = await context.newPage();

   try {
      await page.goto('/sign-up');
      // The inputs carry `id`, not `name`.
      await page.locator('#name').fill(`Probe ${stamp}`);
      await page.locator('#email').fill(email);
      await page.locator('input[type="password"]').first().fill('probe-password-1234');
      await page
         .getByRole('button', { name: /sign up|create/i })
         .first()
         .click();

      // Onboarding, then the workspace.
      await page.waitForURL((url) => !url.pathname.startsWith('/sign-up'), { timeout: 60_000 });
      await settle(page, 4000);

      if (page.url().includes('/onboarding')) {
         await page.locator('input').first().fill(`Probe Workspace ${stamp}`);
         await page
            .getByRole('button', { name: /create|continue/i })
            .first()
            .click();
         await page.waitForURL((url) => !url.pathname.includes('/onboarding'), { timeout: 60_000 });
      }
      await settle(page, 6000);

      const user = await one<{ id: string }>(`select id from "user" where email = $1`, email);
      expect(user, 'the sign-up did not create a user').toBeTruthy();

      const org = await one<{ id: string; slug: string }>(
         `select o.id, o.slug from organization o
            join member m on m.organization_id = o.id
           where m.user_id = $1`,
         user!.id
      );
      expect(org, 'no workspace was provisioned').toBeTruthy();

      const agent = await one<{ id: string; name: string; type: string }>(
         `select u.id, u.name, u.type from "user" u
            join member m on m.user_id = u.id
           where m.organization_id = $1 and u.type = 'agent'`,
         org!.id
      );
      expect(agent, 'the new workspace has no agent').toBeTruthy();
      expect(agent!.name).toBe('scout');

      // And it must be on the team, or it cannot be assigned an issue there.
      const onTeam = await one<{ n: number }>(
         `select count(*)::int as n from team_member tm
            join team t on t.id = tm.team_id
           where tm.user_id = $1 and t.organization_id = $2`,
         agent!.id,
         org!.id
      );
      expect(Number(onTeam?.n), 'the agent is in the workspace but on no team').toBeGreaterThan(0);

      // An agent never signs in, so it must have no credentials.
      const accounts = await one<{ n: number }>(
         `select count(*)::int as n from account where user_id = $1`,
         agent!.id
      );
      expect(Number(accounts?.n), 'the agent has sign-in credentials').toBe(0);
   } finally {
      await context.close();
      const user = await one<{ id: string }>(`select id from "user" where email = $1`, email);
      if (user) {
         const org = await one<{ id: string }>(
            `select organization_id as id from member where user_id = $1`,
            user.id
         );
         if (org) {
            await query(`delete from workflow_state where organization_id = $1`, org.id);
            await query(`delete from label where organization_id = $1`, org.id);
            await query(
               `delete from team_member where team_id in (select id from team where organization_id = $1)`,
               org.id
            );
            await query(`delete from team where organization_id = $1`, org.id);
            await query(`delete from member where organization_id = $1`, org.id);
            await query(`delete from "user" where id like $1`, `agent_${org.id}`);
            await query(`delete from organization where id = $1`, org.id);
         }
         await query(`delete from session where user_id = $1`, user.id);
         await query(`delete from account where user_id = $1`, user.id);
         await query(`delete from "user" where id = $1`, user.id);
      }
   }
});
