import { eveChannel } from 'eve/channels/eve';
import { httpBasic, localDev, placeholderAuth, vercelOidc } from 'eve/channels/auth';

/**
 * Who may talk to the agent.
 *
 * The only caller in production is Circle's own server — `app/api/agent/dispatch`
 * posts a session when an issue is assigned to `scout`. That is a
 * server-to-server call with no browser and no cookie, so the app's Better Auth
 * session is not the credential to check here; a shared secret is.
 *
 * `routeAuth` walks these in order and stops at the first that authenticates:
 *
 *   1. `vercelOidc` — the eve TUI and other Vercel deployments.
 *   2. `localDev` — `eve dev` and the REPL. Returns null off a dev host, and
 *      it reads the deployment rather than the request, so no header can flip it.
 *   3. `httpBasic` — Circle's dispatch, when `AGENT_CHANNEL_SECRET` is set.
 *   4. `placeholderAuth` — a deliberate 401 rather than an open door.
 *
 * The order matters: `placeholderAuth` stays last so that a deployment with no
 * secret configured **refuses** requests instead of serving them. Swapping it
 * for `none()` would make the agent public, which is a decision to take on
 * purpose for a demo, not by forgetting an environment variable.
 */
const sharedSecret = process.env.AGENT_CHANNEL_SECRET;

export default eveChannel({
   auth: [
      vercelOidc(),
      localDev(),
      // Only offered when a secret exists; an empty password would otherwise
      // authenticate anyone who sent an empty password.
      ...(sharedSecret ? [httpBasic({ username: 'circle', password: sharedSecret })] : []),
      placeholderAuth(),
   ],
});
