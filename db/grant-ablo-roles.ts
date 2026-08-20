/**
 * Grants Ablo's two logins access to the synced tables.
 *
 * `ablo connect` does this when it provisions the roles, so this is only for
 * tables added afterwards: a new table needs the publication membership, a
 * replica identity, and these grants, or the snapshot fails with a permission
 * error and rows never load.
 */
import { sql } from 'drizzle-orm';
import { db, getPool } from './index';
import { schema as abloSchema } from '../ablo/schema';

/**
 * Only the application's synced tables. A blanket ALL TABLES grant also covers
 * Ablo's own ledger, and giving the writer DELETE on its replay fence is
 * exactly what its safety check refuses.
 */
const tables = Object.values(abloSchema.models ?? {})
   .map((model: { tableName?: string }) => model.tableName)
   .filter((name): name is string => Boolean(name))
   .sort();

async function main() {
   const roles = await db.execute(sql`
      select rolname from pg_roles where rolname like 'ablo_%' order by rolname`);
   for (const { rolname } of roles.rows as { rolname: string }[]) {
      const write = rolname.startsWith('ablo_writer');
      await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO "${rolname}"`));
      for (const table of tables) {
         await db.execute(
            sql.raw(
               `GRANT SELECT${write ? ', INSERT, UPDATE, DELETE' : ''} ON "public"."${table}" TO "${rolname}"`
            )
         );
      }
      console.log(
         'granted:',
         rolname,
         write ? '(read/write)' : '(read)',
         `on ${tables.length} tables`
      );
   }
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await getPool().end();
   });
