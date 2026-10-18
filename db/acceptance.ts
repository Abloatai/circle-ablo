import { readFileSync } from 'node:fs';

export interface AcceptanceMapping {
   fixtureId: string;
   databaseName: string;
   databaseRole: string;
   abloTenantId: string;
   organizationId: string;
   teamId: string;
   userIds: string[];
}
export interface Queryable {
   query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export function parseMapping(value: unknown): AcceptanceMapping {
   if (!value || typeof value !== 'object') throw new Error('Acceptance mapping required');
   const m = value as AcceptanceMapping;
   for (const key of [
      'fixtureId',
      'databaseName',
      'databaseRole',
      'abloTenantId',
      'organizationId',
      'teamId',
   ] as const) {
      if (typeof m[key] !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(m[key])) {
         throw new Error(`Invalid acceptance mapping field: ${key}`);
      }
   }
   if (!/^circle_acceptance_[a-z0-9_]+$/.test(m.databaseName)) {
      throw new Error('A dedicated circle_acceptance_ database is required');
   }
   if (
      !Array.isArray(m.userIds) ||
      m.userIds.length !== 3 ||
      m.userIds.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) ||
      new Set(m.userIds).size !== 3
   )
      throw new Error('Exactly three distinct fixture users required');
   return { ...m, userIds: [...m.userIds] };
}

export function readAcceptanceMapping(): AcceptanceMapping {
   const path = process.env.CIRCLE_ACCEPTANCE_MAPPING;
   if (!path) throw new Error('CIRCLE_ACCEPTANCE_MAPPING must name a nonsecret mapping file');
   // Do not include file contents or connection strings in errors.
   let value: unknown;
   try {
      value = JSON.parse(readFileSync(path, 'utf8'));
   } catch {
      throw new Error('Cannot read acceptance mapping');
   }
   return parseMapping(value);
}

const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';

export async function assertAcceptanceDatabase(
   db: Queryable,
   mapping: AcceptanceMapping
): Promise<void> {
   const m = parseMapping(mapping);
   const { rows } =
      await db.query(`select current_database() as name, current_user as role, current_schema() as schema,
    shobj_description(oid, 'pg_database') as marker
    from pg_database where datname = current_database()`);
   if (
      rows.length !== 1 ||
      rows[0].name !== m.databaseName ||
      rows[0].role !== m.databaseRole ||
      rows[0].schema !== 'public' ||
      rows[0].marker !== `circle-acceptance/${m.fixtureId}/${m.abloTenantId}`
   ) {
      throw new Error('Database identity or dedicated fixture marker mismatch');
   }
}

// shortcut: preflight assumes one exclusive fixture runner; use a locked seed
// transaction before supporting concurrent initialization. No existing rows are deleted.
export async function assertEmptySeedDatabase(
   db: Queryable,
   mapping: AcceptanceMapping
): Promise<void> {
   await assertAcceptanceDatabase(db, mapping);
   const { rows } = await db.query(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`
   );
   if (!rows.length) throw new Error('Migrate the dedicated fixture before seeding');
   for (const row of rows) {
      if (typeof row.tablename !== 'string') throw new Error('Invalid table inventory');
      const result = await db.query(
         `select exists (select 1 from public.${quote(row.tablename)} limit 1) as occupied`
      );
      if (result.rows[0]?.occupied !== false) {
         throw new Error(
            'Seed refused: public tables must be empty; existing data is never cleared'
         );
      }
   }
}

export async function loadAcceptancePeople(db: Queryable, mapping: AcceptanceMapping) {
   await assertAcceptanceDatabase(db, mapping);
   const { rows: orgs } = await db.query('select id, slug from organization order by id');
   if (
      orgs.length !== 1 ||
      orgs[0].id !== mapping.organizationId ||
      typeof orgs[0].slug !== 'string'
   ) {
      throw new Error('Expected exactly the mapped fixture organization');
   }
   // Existing baseline specs use unqualified tenant lookups. Refuse a mixed database.
   const { rows: tables } = await db.query(`select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'ablo_tenant_id' order by table_name`);
   if (!tables.length) throw new Error('No tenant-scoped fixture tables found');
   for (const row of tables) {
      if (typeof row.table_name !== 'string') throw new Error('Invalid tenant table inventory');
      const result = await db.query(
         `select exists (select 1 from public.${quote(row.table_name)}
      where ablo_tenant_id is distinct from $1) as foreign_tenant`,
         [mapping.abloTenantId]
      );
      if (result.rows[0]?.foreign_tenant !== false)
         throw new Error('Mixed or missing fixture tenant');
   }
   const people = [];
   for (const id of mapping.userIds) {
      const { rows } = await db.query(
         `select u.id, u.name, u.email from "user" u
      where u.id = $1 and coalesce(u.type, 'human') = 'human'
      and exists (select 1 from member m where m.user_id = u.id and m.organization_id = $2)
      and exists (select 1 from account a where a.user_id = u.id and a.provider_id = 'credential')`,
         [id, mapping.organizationId]
      );
      if (
         rows.length !== 1 ||
         typeof rows[0].name !== 'string' ||
         typeof rows[0].email !== 'string'
      ) {
         throw new Error('Mapped fixture user or credential missing');
      }
      const teams = await db.query(
         `select t.id from team t join team_member tm on tm.team_id = t.id
      where tm.user_id = $1 and t.organization_id = $2 and t.archived_at is null
      order by case when t.id = $3 then 0 else 1 end, t.id`,
         [id, mapping.organizationId, mapping.teamId]
      );
      const teamIds = teams.rows.map((row) => row.id);
      if (
         teamIds[0] !== mapping.teamId ||
         teamIds.some((id) => typeof id !== 'string') ||
         new Set(teamIds).size !== teamIds.length
      )
         throw new Error('Mapped shared team membership missing or ambiguous');
      people.push({
         id,
         name: rows[0].name,
         email: rows[0].email,
         orgId: mapping.organizationId,
         orgSlug: orgs[0].slug,
         teamIds: teamIds as string[],
      });
   }
   return people;
}
