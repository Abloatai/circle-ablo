import { test, expect } from '../helpers/fixtures';
import { writeFile } from 'node:fs/promises';
test('measure repeated accepted source edits', async ({ alice, secondTab, who }) => {
   test.skip(
      !process.env.LOBBY_CONTROL_URL ||
         !process.env.LOBBY_CONTROL_TOKEN ||
         !process.env.LOBBY_PERF_OUTPUT,
      'Requires isolated source performance harness'
   );
   test.setTimeout(480000);
   const pages = [alice, secondTab],
      events: Record<string, unknown>[] = [],
      samples: Record<string, unknown>[] = [];
   const control = async (label: string) => {
      const response = await fetch(
         process.env.LOBBY_CONTROL_URL + '/edit?label=' + encodeURIComponent(label),
         { headers: { authorization: 'Bearer ' + process.env.LOBBY_CONTROL_TOKEN } }
      );
      expect(response.ok, await response.clone().text()).toBeTruthy();
      return response.json();
   };
   const landing = `/${who[0].orgSlug}/team/${who[0].teamIds[0]}/all`;
   for (const [index, page] of pages.entries()) {
      page.on('console', (msg) => {
         if (msg.text().includes('Fast Refresh') || msg.text().includes('[HMR]'))
            events.push({ kind: 'hmr', page: index, at: Date.now(), text: msg.text() });
      });
      await page.goto(landing);
      await expect(page.getByRole('button', { name: 'New issue', exact: true })).toBeVisible();
      await page.evaluate(() => {
         const w = window;
         w.perfSamples = [];
         w.perfTarget = null;
         w.perfDocument = crypto.randomUUID();
         new MutationObserver(() => {
            if (!w.perfTarget) return;
            const button = Array.from(document.querySelectorAll('button')).find(
               (b) => b.textContent?.trim() === w.perfTarget
            );
            if (!button || !button.getClientRects().length) return;
            const label = w.perfTarget;
            w.perfTarget = null;
            const mutationAt = Date.now();
            requestAnimationFrame(() =>
               requestAnimationFrame(() =>
                  w.perfSamples.push({ label, mutationAt, frameAt: Date.now() })
               )
            );
         }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
   }
   const identities = await Promise.all(
      pages.map((p) =>
         p.evaluate(() => ({
            marker: window.perfDocument,
            timeOrigin: performance.timeOrigin,
         }))
      )
   );
   let navigations = 0;
   for (const p of pages)
      p.on('request', (r) => {
         if (r.isNavigationRequest() && r.frame() === p.mainFrame()) navigations++;
      });
   try {
      for (let i = 0; i < 6; i++) {
         const label = i % 2 ? 'New issue' : 'Create issue live';
         await Promise.all(
            pages.map((p) =>
               p.evaluate((label) => {
                  window.perfTarget = label;
               }, label)
            )
         );
         const start = Date.now(),
            result = await control(label),
            responseAt = Date.now();
         await Promise.all(
            pages.map((p) =>
               expect(p.getByRole('button', { name: label, exact: true })).toBeVisible({
                  timeout: 60000,
               })
            )
         );
         await Promise.all(
            pages.map((p) =>
               p.waitForFunction((n) => window.perfSamples.length === n, i + 1, {
                  timeout: 60000,
               })
            )
         );
         const observations = await Promise.all(
            pages.map((p) => p.evaluate(() => window.perfSamples.at(-1)))
         );
         samples.push({
            iteration: i,
            firstMeasuredEdit: i === 0,
            start,
            responseAt,
            acceptanceMs: result.acceptanceMs,
            operationId: result.operationId,
            manifest: result.source.manifest,
            observations,
         });
         expect(navigations).toBe(0);
         for (let n = 0; n < 2; n++)
            expect(
               await pages[n].evaluate(() => ({
                  marker: window.perfDocument,
                  timeOrigin: performance.timeOrigin,
               }))
            ).toEqual(identities[n]);
      }
   } finally {
      await writeFile(
         process.env.LOBBY_PERF_OUTPUT!,
         JSON.stringify({ case: process.env.LOBBY_CASE, samples, events, navigations }, null, 2)
      );
      await control('New issue');
   }
   expect(samples).toHaveLength(6);
});
