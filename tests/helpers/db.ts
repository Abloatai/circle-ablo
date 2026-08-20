import { sql } from 'drizzle-orm';
import { db, getPool } from '@/db';

/**
 * Ground truth.
 *
 * Assertions go through here rather than through the UI. Two of the throwaway
 * checks written while building these features passed while proving nothing —
 * one watched the sidebar while the membership was unchanged, another notified
 * someone who was already a participant. A test that reads the screen it just
 * wrote to is not evidence.
 */
export async function query<T = Record<string, unknown>>(
   text: string,
   ...values: unknown[]
): Promise<T[]> {
   const result = await db.execute(sql.raw(interpolate(text, values)));
   return (result.rows ?? result) as T[];
}

/** Positional `$1` style, escaped — these are test-only literals. */
function interpolate(text: string, values: unknown[]): string {
   return text.replace(/\$(\d+)/g, (_, index) => {
      const value = values[Number(index) - 1];
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return `'${String(value).replace(/'/g, "''")}'`;
   });
}

export async function one<T = Record<string, unknown>>(
   text: string,
   ...values: unknown[]
): Promise<T | undefined> {
   return (await query<T>(text, ...values))[0];
}

export async function count(text: string, ...values: unknown[]): Promise<number> {
   const row = await one<{ n: number | string }>(text, ...values);
   return Number(row?.n ?? 0);
}

export async function closeDb(): Promise<void> {
   await getPool().end();
}
