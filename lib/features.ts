/**
 * Features that exist in the codebase but are not switched on.
 *
 * A flag rather than deleted code: the surface is worth keeping and the work to
 * make it real is planned, so this is the one line to flip when it lands.
 */

/**
 * The code-review section — a PR inbox with a diff viewer and a review guide.
 *
 * Backed by repositories explicitly mapped to one of the viewer's teams. Lists,
 * details, diffs and submitted reviews come from GitHub at request time.
 */
export const REVIEWS_ENABLED = true;

/**
 * Connected accounts.
 *
 * Off because none of them connect to anything. There is no OAuth flow, no
 * installation and nowhere to store a connection, so every card in it is a
 * picture of an integration.
 *
 * Connected accounts was worse than a dead button: it listed a GitHub account
 * called "octo-relay" with a Connected badge, so settings asserted a link that
 * has never existed and sent people looking for a repository picker.
 *
 * GitHub installations now live in Settings → Integrations. This flag remains
 * only for the separate personal-account OAuth surface, which is not built.
 */
export const CONNECTED_ACCOUNTS_ENABLED = false;
