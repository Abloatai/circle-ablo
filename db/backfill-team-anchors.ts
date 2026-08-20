/**
 * Fills `team_id` on rows that live inside an issue or a project.
 *
 * Run once after adding the column; new rows set it on write. Without it those
 * rows belong to no sync group and never reach a client.
 */
import { sql } from 'drizzle-orm';
import { db, getPool } from './index';

const statements = [
   sql`update issue_label c set team_id = i.team_id from issue i where i.id = c.issue_id and c.team_id is null`,
   sql`update comment c set team_id = i.team_id from issue i where i.id = c.issue_id and c.team_id is null`,
   sql`update issue_activity c set team_id = i.team_id from issue i where i.id = c.issue_id and c.team_id is null`,
   sql`update project_label c set team_id = p.team_id from project p where p.id = c.project_id and c.team_id is null`,
   sql`update project_milestone c set team_id = p.team_id from project p where p.id = c.project_id and c.team_id is null`,
   sql`update project_update c set team_id = p.team_id from project p where p.id = c.project_id and c.team_id is null`,
   sql`update project_resource c set team_id = p.team_id from project p where p.id = c.project_id and c.team_id is null`,
];

async function main() {
   for (const statement of statements) {
      const result = await db.execute(statement);
      console.log('backfilled rows:', result.rowCount ?? 0);
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
