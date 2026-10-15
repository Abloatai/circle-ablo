import { test, expect } from '../helpers/fixtures';
import { one, count } from '../helpers/db';
import { type as typeInto } from '../helpers/ui';
test('accepted source edits and reconnect preserve authenticated issue creation', async ({
   alice,
   secondTab,
   who,
}) => {
   test.skip(
      !process.env.LOBBY_CONTROL_URL || !process.env.LOBBY_CONTROL_TOKEN,
      'Requires the isolated Lobby source-control harness'
   );
   test.setTimeout(240000);
   const control = async (path: string) => {
      const r = await fetch(process.env.LOBBY_CONTROL_URL + path, {
         headers: { authorization: 'Bearer ' + process.env.LOBBY_CONTROL_TOKEN },
      });
      expect(r.ok, await r.clone().text()).toBeTruthy();
      return r.json();
   };
   const me = who[0],
      landing = `/${me.orgSlug}/team/${me.teamIds[0]}/all`;
   await alice.goto(landing);
   await secondTab.goto(landing);
   await expect(alice.getByRole('button', { name: 'New issue', exact: true })).toBeVisible();
   const pages = [alice, secondTab];
   let documentRequests = 0;
   const documents = await Promise.all(
      pages.map((page) =>
         page.evaluate(() => {
            (window as any).lobbyDocumentMarker = crypto.randomUUID();
            return {
               marker: (window as any).lobbyDocumentMarker,
               timeOrigin: performance.timeOrigin,
            };
         })
      )
   );
   for (const page of pages)
      page.on('request', (request) => {
         if (request.isNavigationRequest() && request.frame() === page.mainFrame())
            documentRequests++;
      });
   const timings: any[] = [];
   async function accepted(label: string) {
      const start = Date.now();
      const result = await control('/edit?label=' + encodeURIComponent(label));
      return { start, result };
   }
   const first = await accepted('Create issue live');
   await expect(alice.getByRole('button', { name: 'Create issue live', exact: true })).toBeVisible({
      timeout: 60000,
   });
   await expect(
      secondTab.getByRole('button', { name: 'Create issue live', exact: true })
   ).toBeVisible({ timeout: 60000 });
   timings.push({
      label: 'live',
      requestToObservedMs: Date.now() - first.start,
      acceptanceMs: first.result.acceptanceMs,
   });
   await control('/pause');
   const missed = await accepted('Create issue recovered');
   expect(missed.result.source.manifest).not.toBe(first.result.source.manifest);
   await alice.waitForTimeout(1800);
   await expect(
      alice.getByRole('button', { name: 'Create issue live', exact: true })
   ).toBeVisible();
   await expect(
      alice.getByRole('button', { name: 'Create issue recovered', exact: true })
   ).toHaveCount(0);
   const resumed = Date.now();
   await control('/resume');
   await expect(
      alice.getByRole('button', { name: 'Create issue recovered', exact: true })
   ).toBeVisible({ timeout: 60000 });
   await expect(
      secondTab.getByRole('button', { name: 'Create issue recovered', exact: true })
   ).toBeVisible({ timeout: 60000 });
   timings.push({
      label: 'recovery',
      resumeToObservedMs: Date.now() - resumed,
      acceptanceMs: missed.result.acceptanceMs,
   });
   const documentRequestsAtRecovery = documentRequests;
   expect(documentRequestsAtRecovery, 'source changes must not request a new document').toBe(0);
   for (let i = 0; i < pages.length; i++)
      expect(
         await pages[i].evaluate(() => ({
            marker: (window as any).lobbyDocumentMarker,
            timeOrigin: performance.timeOrigin,
         }))
      ).toEqual(documents[i]);
   const before = await count(
      'select count(*)::int as n from issue where team_id=$1',
      me.teamIds[0]
   );
   const title = 'live source acceptance ' + Date.now();
   await alice.getByRole('button', { name: 'Create issue recovered', exact: true }).click();
   const dialog = alice.getByRole('dialog');
   await dialog.waitFor({ state: 'visible' });
   await typeInto(dialog.getByPlaceholder(/issue title/i).first(), title);
   await dialog
      .getByRole('button', { name: /create issue/i })
      .first()
      .click();
   await expect
      .poll(
         async () => one<{ team_id: string }>('select team_id from issue where title=$1', title),
         { timeout: 20000 }
      )
      .toEqual({ team_id: me.teamIds[0] });
   expect(await count('select count(*)::int as n from issue where team_id=$1', me.teamIds[0])).toBe(
      before + 1
   );
   await expect(secondTab.getByText(title).first()).toBeVisible({ timeout: 30000 });
   await accepted('New issue');
   await expect(alice.getByRole('button', { name: 'New issue', exact: true })).toBeVisible({
      timeout: 60000,
   });
   console.log(
      'live-source-evidence',
      JSON.stringify({
         timings,
         documentRequestsAtRecovery,
         documentIdentityPreserved: true,
         postRecoveryPersistence: true,
         peerDelivery: true,
      })
   );
});
