import { webSearch } from 'eve/tools';

/**
 * Search through Exa.
 *
 * Provider-managed: the AI Gateway runs the search, so this needs no separate
 * API key and no separate account — the same balance that pays for the model
 * pays for the search. It applies only while the agent's model routes through
 * the gateway.
 *
 * `webSearch()` with no argument would also give Exa, since it is the gateway's
 * default. Naming it is deliberate: a default that changes upstream would
 * change what this agent cites without anything in this repository moving.
 */
export default webSearch({ provider: 'exa' });
