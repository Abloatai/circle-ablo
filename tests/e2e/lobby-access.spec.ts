import { test, expect } from '../helpers/fixtures';
import { query } from '../helpers/db';
import Ablo from '@abloatai/ablo';
import { schema } from '../../ablo/schema';

test('scoped Circle sessions cannot read another team by ID or filter', async ({
   alice,
   who,
   playwright,
}) => {
   const anonymous = await playwright.request.newContext({ baseURL: 'http://localhost:3100' });
   try {
      expect((await anonymous.post('/api/ablo-session')).status()).toBe(401);
   } finally {
      await anonymous.dispose();
   }
   expect(
      (
         await alice.request.post('/api/ablo-session', {
            headers: { origin: 'https://foreign.invalid' },
         })
      ).status()
   ).toBe(403);
   const response = await alice.request.post('/api/ablo-session', {
      headers: { origin: 'http://localhost:3100' },
   });
   expect(response.status()).toBe(200);
   const { token } = await response.json();
   const rows = await query<{ id: string; team_id: string }>(
      'select id,team_id from issue order by id'
   );
   const own = rows.find((r) => who[0].teamIds.includes(r.team_id));
   const foreign = rows.find((r) => !who[0].teamIds.includes(r.team_id));
   expect(own, 'fixture must contain an authorized issue').toBeTruthy();
   expect(foreign, 'fixture must contain an unauthorized team issue').toBeTruthy();
   const forbiddenCreate = await alice.request.post('/api/issues', {
      data: { teamId: foreign!.team_id, title: 'forbidden team issue' },
   });
   expect(forbiddenCreate.status()).toBe(403);
   const client = Ablo({ schema, apiKey: token, baseURL: process.env.ABLO_API_URL, transport: 'http' });
   try {
      await client.ready();
      expect((await client.issue.read({ id: own!.id }))?.id).toBe(own!.id);
      expect(await client.issue.read({ id: foreign!.id })).toBeUndefined();
      expect(await client.issue.listAll({ where: { teamId: foreign!.team_id } })).toEqual([]);
      console.log(
         'access evidence',
         JSON.stringify({
            anonymousStatus: 401,
            crossOriginStatus: 403,
            sessionStatus: 200,
            ownId: own!.id,
            foreignId: foreign!.id,
            foreignTeam: foreign!.team_id,
            foreignRead: 'absent',
            foreignListCount: 0,
         })
      );
   } finally {
      await client.dispose();
   }
});
