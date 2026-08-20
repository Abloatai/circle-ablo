# Deploying Circle

What a production deployment needs, and why each piece is there.

---

## The shape of it

Circle is one Next.js app plus one agent runtime, over one Postgres:

- **Next.js** — the app. Reads and writes workspace data through Ablo, reads
  identity through Drizzle.
- **eve** — the agent runtime `scout` runs in. A separate process, reached over
  HTTP by `app/api/agent/dispatch`.
- **Neon Postgres** — the source of truth. Ablo replicates from it.
- **Ablo** — the write path and the sync stream.

---

## 1. Ablo needs a production plane

`ablo dev` gives you a **sandbox branch** key, which is what `.env.local` holds
in development. A branch is an isolation unit: rows written on it are invisible
to production, and its schema history is its own. Production needs a key of its
own.

```bash
# 1. A secret production key from the Ablo dashboard — `ablo login` does not
#    grant production authority, it stores a management credential that cannot
#    write application data or push the production schema.
export ABLO_API_KEY=sk_…

# 2. Register the production database against the production root, once.
npx ablo connect apply --url postgres://…   # the DIRECT host, see below
npx ablo connect check

# 3. Push the schema to production.
npx ablo push

# 4. Confirm what the key acts on before trusting any of it.
npx ablo whoami
npx ablo doctor
```

**Register the direct host, not the pooler.** Replication needs a session, and
a pooler terminates it — refusing the connection in the same words a wrong
password would, so a pooled host reads as a credentials problem for as long as
you let it. This is deliberately the opposite of what the _app_ uses:
`db/index.ts` runs request handlers on `DATABASE_URL_POOLED` because many
short-lived handlers are exactly what PgBouncer is for. Two different
connections, two different right answers. Do not "fix" either into the other.

Two more things that bite here:

- **`wal_level = logical` needs a server restart.** It is the one setup step
  with downtime in it — schedule it.
- **Ablo holds the database connections, not your functions.** At most four per
  plane, whether one caller is writing or ten thousand. Size the database for
  that, not for your function count.

---

## 2. Environment

| Variable               | Needed for               | Missing means                                                             |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `DATABASE_URL`         | Migrations, seed, DDL    | Nothing runs.                                                             |
| `DATABASE_URL_POOLED`  | Every request handler    | Falls back to the direct host — works, but see `db/index.ts`.             |
| `BETTER_AUTH_SECRET`   | Sessions                 | Nothing runs.                                                             |
| `BETTER_AUTH_URL`      | Sign-in origin           | Sign-in returns 403 from any other origin.                                |
| `ABLO_API_KEY`         | Every write              | Nothing writes.                                                           |
| `EVE_URL`              | Agent dispatch           | **Dispatch throws** rather than quietly trying localhost.                 |
| `AGENT_CHANNEL_SECRET` | Agent dispatch           | The channel has no authenticator for Circle's calls and answers 401.      |
| `AI_GATEWAY_API_KEY`   | `scout` completing a run | The agent's tools work; the model call does not.                          |
| `RESEND_API_KEY`       | Invitation email         | Invitations log to the console. Degrades gracefully — the app still runs. |
| `EMAIL_FROM`           | Invitation sender        | Falls back to `Circle <onboarding@resend.dev>`.                           |

---

## 3. What the agent channel accepts

`agent/channels/eve.ts` walks its authenticators in order and stops at the first
that authenticates:

1. `vercelOidc()` — the eve TUI and other Vercel deployments.
2. `localDev()` — `eve dev` and the REPL. It reads the deployment, never the
   request, so no header can flip it on a production host.
3. `httpBasic()` — Circle's own dispatch, and **only when
   `AGENT_CHANNEL_SECRET` is set**. An empty password would otherwise
   authenticate anyone who sent an empty password.
4. `placeholderAuth()` — a deliberate 401.

`placeholderAuth` stays last so a deployment with no secret configured
**refuses** rather than serving. Making the agent public is `none()`, which is a
decision to take on purpose for a demo — not something that should happen by
forgetting a variable.

Verified: no credential, wrong password and wrong username each get 401; the
correct credential is accepted; and with no secret configured even a
correct-looking credential is refused.

---

## 4. Order

1. Neon: production database, `wal_level = logical`, restart.
2. Drizzle: `pnpm db:migrate` against `DATABASE_URL`.
3. Ablo: `connect apply`, `connect check`, `push`, `doctor`.
4. Deploy the app with the table above filled in.
5. Deploy eve, set `EVE_URL` and `AGENT_CHANNEL_SECRET` on both sides.
6. Assign an issue to `scout` and watch the run row.

Seeding is for development. `pnpm db:seed` truncates the work tables.
