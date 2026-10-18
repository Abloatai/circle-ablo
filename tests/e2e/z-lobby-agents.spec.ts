import { test, expect } from '../helpers/fixtures';
import { one, count } from '../helpers/db';
import { type as typeInto } from '../helpers/ui';
import { writeFile } from 'node:fs/promises';
interface AgentStatus {
   error?: string;
   round: number;
   running: boolean;
   stale: number;
   commits: { actor: string }[];
}

test('ten model agents change the live form across two application hosts', async ({
   alice,
   secondTab,
   who,
}) => {
   test.skip(
      ![
         'LOBBY_PEER_WS',
         'LOBBY_PEER_CONTROL',
         'LOBBY_PEER_TOKEN',
         'LOBBY_CONTROL_URL',
         'LOBBY_CONTROL_TOKEN',
         'LOBBY_PERF_OUTPUT',
      ].every((name) => process.env[name]),
      'Requires the isolated two-host model-agent harness'
   );
   test.setTimeout(1200000);
   const command = async (path: string, peer = false) => {
      const r = await fetch(
         (peer ? process.env.LOBBY_PEER_CONTROL : process.env.LOBBY_CONTROL_URL) + path,
         {
            headers: {
               authorization:
                  'Bearer ' +
                  (peer ? process.env.LOBBY_PEER_TOKEN : process.env.LOBBY_CONTROL_TOKEN),
            },
         }
      );
      expect(r.ok, await r.clone().text()).toBeTruthy();
      return r.json();
   };
   const pages = [alice, secondTab],
      me = who[0],
      landing = `/${me.orgSlug}/team/${me.teamIds[0]}/all`,
      events: Record<string, unknown>[] = [];
   for (const [index, page] of pages.entries()) {
      await page.goto(landing);
      await expect(page.getByRole('button', { name: 'New issue', exact: true })).toBeVisible();
      page.on('console', (m) => {
         if (m.text().includes('Fast Refresh'))
            events.push({ kind: 'hmr', page: index, at: Date.now(), text: m.text() });
      });
   }
   const identities = await Promise.all(
      pages.map((page) =>
         page.evaluate(() => {
            window.lobbyIdentity = crypto.randomUUID();
            return window.lobbyIdentity;
         })
      )
   );
   let navigations = 0;
   for (const p of pages)
      p.on('request', (r) => {
         if (r.isNavigationRequest() && r.frame() === p.mainFrame()) navigations++;
      });
   const rounds: {
      round: number;
      elapsedMs: number;
      peerResumeToObservedMs: number;
      status: AgentStatus;
   }[] = [];
   for (const round of [1, 2]) {
      if (round === 2) await command('/pause', true);
      const started = Date.now();
      await command('/agents');
      let status: AgentStatus | undefined;
      await expect
         .poll(
            async () => {
               status = (await command('/status')) as AgentStatus;
               if (status.error) throw Error(status.error);
               return status.round === round && !status.running;
            },
            { timeout: 600000, intervals: [1000] }
         )
         .toBe(true);
      if (!status) throw new Error('Agent status was not observed');
      for (let i = 0; i < 10; i++)
         await expect(
            alice.getByRole('button', { name: 'New issue', exact: true })
         ).toHaveAttribute('data-lobby-agent-' + i, String(round), { timeout: 60000 });
      if (round === 2) {
         for (let i = 0; i < 10; i++)
            await expect(
               secondTab.getByRole('button', { name: 'New issue', exact: true })
            ).toHaveAttribute('data-lobby-agent-' + i, '1');
         await command('/resume', true);
      }
      const resumeAt = Date.now();
      for (let i = 0; i < 10; i++)
         await expect(
            secondTab.getByRole('button', { name: 'New issue', exact: true })
         ).toHaveAttribute('data-lobby-agent-' + i, String(round), { timeout: 60000 });
      const peerObservedAt = Date.now();
      for (const page of pages) {
         await page.getByRole('button', { name: 'New issue', exact: true }).click();
         const dialog = page.getByRole('dialog');
         await expect(dialog).toBeVisible();
         for (const selector of ['priority', 'status', 'label', 'assignee', 'project'])
            await expect(
               dialog.getByRole('combobox', {
                  name: 'Issue ' + selector + (round === 2 ? ' now' : ''),
               })
            ).toHaveAttribute('title', 'Choose issue ' + selector + (round === 2 ? ' now' : ''));
         await page.keyboard.press('Escape');
         await expect(dialog).toHaveCount(0);
      }
      expect(navigations).toBe(0);
      for (let i = 0; i < 2; i++)
         expect(await pages[i].evaluate(() => window.lobbyIdentity)).toBe(identities[i]);
      rounds.push({
         round,
         elapsedMs: Date.now() - started,
         peerResumeToObservedMs: peerObservedAt - resumeAt,
         status,
      });
   }
   const last = rounds.at(-1)?.status;
   if (!last) throw new Error('No agent round completed');
   expect(last.stale).toBeGreaterThan(0);
   expect(new Set(last.commits.map((c) => c.actor)).size).toBe(10);
   const before = await count(
      'select count(*)::int as n from issue where team_id=$1',
      me.teamIds[0]
   );
   const title = 'ten agents authenticated ' + Date.now();
   await alice.getByRole('button', { name: 'New issue', exact: true }).click();
   const dialog = alice.getByRole('dialog');
   await typeInto(dialog.getByPlaceholder(/issue title/i).first(), title);
   await dialog
      .getByRole('button', { name: /create issue/i })
      .first()
      .click();
   await expect
      .poll(() => one('select team_id from issue where title=$1', title), { timeout: 30000 })
      .toEqual({ team_id: me.teamIds[0] });
   expect(await count('select count(*)::int as n from issue where team_id=$1', me.teamIds[0])).toBe(
      before + 1
   );
   await expect(secondTab.getByText(title).first()).toBeVisible({ timeout: 30000 });
   await writeFile(
      process.env.LOBBY_PERF_OUTPUT!.replace('-samples.json', '-agents.json'),
      JSON.stringify(
         { rounds, events, navigations, postAgentPersistence: true, peerDelivery: true },
         null,
         2
      )
   );
});
