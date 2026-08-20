/**
 * Fills Ablo's tenancy column on rows that predate it.
 *
 * Ablo both filters reads on this column and requires it to accept a write, so
 * a row without it is invisible to the sync layer. New rows get it from Ablo
 * itself; these are the seeded ones.
 *
 * The value is read from the credential rather than configured, because a
 * forgotten env var here is invisible — the rows land fine and simply never
 * appear in the app.
 */
import { sql } from 'drizzle-orm';
import { sync } from '../ablo';
import { db, getPool } from './index';
import { schema as abloSchema } from '../ablo/schema';

const tables = Object.values(abloSchema.models ?? {})
   .map((model: { tableName?: string }) => model.tableName)
   .filter((name): name is string => Boolean(name))
   .sort();

async function main() {
   await sync.ready();
   const tenant = sync.identity?.organizationId;
   if (!tenant) throw new Error('Could not resolve the Ablo tenant id from ABLO_API_KEY');
   console.log('ablo tenant:', tenant);

   for (const table of tables) {
      const result = await db.execute(
         sql.raw(
            `update "public"."${table}" set ablo_tenant_id = '${tenant}' where ablo_tenant_id is null`
         )
      );
      console.log(`${table}: ${result.rowCount ?? 0}`);
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
