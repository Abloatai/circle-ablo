import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Drizzle owns the database shape: tables, columns, constraints, migrations.
 * Ablo never runs DDL, so this pool is also what the seed and Better Auth use.
 *
 * The pool is created on first use so that tooling which only needs to read the
 * schema (drizzle-kit, the Better Auth generator) runs without a live database.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
   if (!pool) {
      // Neon publishes two endpoints for the same database. Request handlers
      // run on the pooled one — that is what PgBouncer is for, and it is a
      // different machine from the compute, so it survives the compute
      // suspending under an idle app. Migrations keep the direct endpoint:
      // `drizzle.config.ts` reads DATABASE_URL, and DDL needs a real session.
      const connectionString = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL is not set');

      pool = new Pool({
         connectionString,
         max: 10,
         /**
          * Nothing here may wait forever, which is what the defaults do.
          *
          * `connectionTimeoutMillis` is 0 by default: a request that asks for a
          * client when none can be had waits with no deadline and no error. The
          * symptom is unmistakable once seen — sign-in taking minutes while the
          * server sits at 0% CPU and the database answers `select 1` in under a
          * second, because nobody is working, everybody is queuing. Deployed,
          * that is a request occupying a function until the platform kills it.
          */
         connectionTimeoutMillis: 10_000,
         // Hand connections back before the far end decides they are stale.
         idleTimeoutMillis: 30_000,
         maxLifetimeSeconds: 600,
         // Generous, because `pnpm db:seed` runs a truncate and batched inserts
         // through this pool — but bounded, so a wedged query cannot become a
         // wedged process.
         statement_timeout: 60_000,
         query_timeout: 60_000,
         // The database is a continent away; without this, a NAT or load
         // balancer silently drops a quiet connection and the next query on it
         // waits for a reply that is never coming.
         keepAlive: true,
      });

      // An idle client that errors takes the process down otherwise — `pg`
      // emits this on the pool, and an unhandled 'error' event is fatal.
      pool.on('error', (error) => {
         console.error('[db] idle client error:', error.message);
      });
   }
   return pool;
}

export const db = drizzle({
   client: new Proxy({} as Pool, {
      get: (_target, prop) => Reflect.get(getPool(), prop, getPool()),
   }),
   schema,
});

export type Database = typeof db;
