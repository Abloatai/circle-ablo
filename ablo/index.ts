import Ablo from '@abloatai/ablo';
import { schema } from './schema';

/**
 * SERVER-ONLY client — it holds the `sk_` key. Used by the session route (to
 * mint scoped tokens for people and agents) and by agent processes. Never
 * import it into a 'use client' component.
 */
export const sync = Ablo({ apiKey: process.env.ABLO_API_KEY, schema });

export type Sync = typeof sync;
