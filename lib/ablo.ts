import { Ablo, humans } from '@abloatai/humans';
import { createAbloReact } from '@abloatai/ablo/react';
import { schema } from '@/ablo/schema';

/**
 * The browser's Ablo client.
 *
 * It comes from `@abloatai/humans` rather than the base package: that is the
 * reactive surface — a local watchable copy, live queries and presence — which
 * is what `useAblo((a) => a.issue.local.list())` reads from. The base factory
 * returns the request/response client agents use.
 *
 * It never holds the API key: it mints a short-lived token from
 * /api/ablo-session, the only place that knows the viewer's org and teams.
 */
export const ablo = Ablo({
   schema,
   authEndpoint: '/api/ablo-session',
   plugins: [humans()],
});

/** Born-typed bindings — `useAblo((a) => a.issue.local.list())` knows the models. */
export const { AbloProvider, useAblo } = createAbloReact(schema);
