/**
 * Ablo's publication needs REPLICA IDENTITY FULL to replicate UPDATE and DELETE
 * for the tables it watches. Run once after adding a synced table.
 */
import { sql } from 'drizzle-orm';
import { db, getPool } from './index';
import { schema as abloSchema } from '../ablo/schema';

const tables = Object.values(abloSchema.models ?? {})
   .map((model: { tableName?: string }) => model.tableName)
   .filter((name): name is string => Boolean(name))
   .sort();

async function main() {
   for (const table of tables) {
      await db.execute(sql.raw(`ALTER TABLE "public"."${table}" REPLICA IDENTITY FULL;`));
      console.log('replica identity full:', table);
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
