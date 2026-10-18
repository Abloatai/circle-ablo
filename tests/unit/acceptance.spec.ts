import assert from 'node:assert/strict';
import { test } from '@playwright/test';
import {
   assertAcceptanceDatabase,
   assertEmptySeedDatabase,
   loadAcceptancePeople,
   parseMapping,
   type AcceptanceMapping,
   type Queryable,
} from '../../db/acceptance';

const mapping: AcceptanceMapping = {
   fixtureId: 'run_001',
   databaseName: 'circle_acceptance_001',
   databaseRole: 'fixture_writer',
   abloTenantId: 'tenant_test',
   organizationId: 'org_circle',
   teamId: 'shared',
   userIds: ['charlie', 'alice', 'bob'],
};
function database(overrides: Record<string, unknown> = {}) {
   const calls: { sql: string; values?: unknown[] }[] = [];
   const state = {
      name: mapping.databaseName,
      role: mapping.databaseRole,
      schema: 'public',
      marker: `circle-acceptance/${mapping.fixtureId}/${mapping.abloTenantId}`,
      occupied: false,
      foreignTenant: false,
      orgs: [{ id: 'org_circle', slug: 'circle' }],
      missingUser: false,
      teamIds: ['shared', 'z-team'],
      tables: ['issue', 'user'],
      ...overrides,
   };
   const db: Queryable = {
      async query(sql, values) {
         calls.push({ sql, values });
         assert.match(sql.trim(), /^select /i, 'guards must issue only reads');
         if (sql.includes('from pg_database')) return { rows: [state] };
         if (sql.includes('from pg_tables'))
            return { rows: state.tables.map((tablename) => ({ tablename })) };
         if (sql.includes(' as occupied')) return { rows: [{ occupied: state.occupied }] };
         if (sql.includes('from organization')) return { rows: state.orgs };
         if (sql.includes('information_schema.columns')) return { rows: [{ table_name: 'issue' }] };
         if (sql.includes(' as foreign_tenant'))
            return { rows: [{ foreign_tenant: state.foreignTenant }] };
         if (sql.includes('from "user" u'))
            return {
               rows: state.missingUser
                  ? []
                  : [
                       {
                          id: values![0],
                          name: String(values![0]),
                          email: `${values![0]}@example.invalid`,
                       },
                    ],
            };
         if (sql.includes('from team t')) return { rows: state.teamIds.map((id) => ({ id })) };
         throw new Error('Unexpected fixture query');
      },
   };
   return { db, calls };
}

test('mapping requires explicit dedicated database and three distinct users', () => {
   assert.throws(() => parseMapping(undefined));
   assert.throws(() => parseMapping({ ...mapping, databaseName: 'production' }));
   assert.throws(() => parseMapping({ ...mapping, teamId: '' }));
   assert.throws(() => parseMapping({ ...mapping, userIds: ['alice', 'alice', 'bob'] }));
   assert.deepEqual(parseMapping(mapping), mapping);
});

for (const [field, value] of Object.entries({
   name: 'shared',
   role: 'other_writer',
   marker: null,
   schema: 'other_schema',
})) {
   test(`database ${field} mismatch refuses before inspecting application tables`, async () => {
      const { db, calls } = database({ [field]: value });
      await assert.rejects(assertAcceptanceDatabase(db, mapping), /identity.*mismatch/);
      assert.equal(calls.length, 1);
   });
}

test('seed refuses existing data rather than truncating it', async () => {
   const { db, calls } = database({ occupied: true });
   await assert.rejects(assertEmptySeedDatabase(db, mapping), /existing data is never cleared/);
   assert.equal(calls.filter((c) => c.sql.includes(' as occupied')).length, 1);
});

test('empty migrated fixture passes; missing migrations fail closed', async () => {
   await assertEmptySeedDatabase(database().db, mapping);
   await assert.rejects(assertEmptySeedDatabase(database({ tables: [] }).db, mapping), /Migrate/);
});

test('table inventory is quoted, including unusual table names', async () => {
   const { db, calls } = database({ tables: ['odd"; delete from issue; --'] });
   await assertEmptySeedDatabase(db, mapping);
   assert.ok(calls.some((c) => c.sql.includes('public."odd""; delete from issue; --"')));
});

test('login rejects another organization instead of selecting the oldest', async () => {
   const { db } = database({
      orgs: [
         { id: 'foreign', slug: 'older' },
         { id: 'org_circle', slug: 'circle' },
      ],
   });
   await assert.rejects(loadAcceptancePeople(db, mapping), /exactly the mapped/);
});

test('login rejects foreign or null tenant rows', async () => {
   await assert.rejects(
      loadAcceptancePeople(database({ foreignTenant: true }).db, mapping),
      /Mixed or missing/
   );
});

test('login uses configured user order and shared team; queries bind tenant and organization', async () => {
   const { db, calls } = database();
   const people = await loadAcceptancePeople(db, mapping);
   assert.deepEqual(
      people.map((p) => p.id),
      ['charlie', 'alice', 'bob']
   );
   assert.ok(people.every((p) => p.teamIds[0] === 'shared'));
   assert.deepEqual(calls.find((c) => c.sql.includes(' as foreign_tenant'))?.values, [
      'tenant_test',
   ]);
   assert.deepEqual(
      calls.filter((c) => c.sql.includes('from team t')).map((c) => c.values),
      mapping.userIds.map((id) => [id, 'org_circle', 'shared'])
   );
});

for (const overrides of [
   { missingUser: true },
   { teamIds: ['wrong'] },
   { teamIds: ['shared', 'shared'] },
]) {
   test(`login refuses missing or ambiguous membership: ${JSON.stringify(overrides)}`, async () => {
      await assert.rejects(loadAcceptancePeople(database(overrides).db, mapping));
   });
}
