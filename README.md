# Circle (Ablo)

An issue tracker where people and agents work on the same data, in real time.

Circle looks like a Linear-style tracker — issues, projects, cycles, teams,
documents, saved views — but the interesting part is underneath. Every change is
a synchronised write: post a comment and it appears in your colleague's browser
without a reload, hand an issue to an agent and you watch it move the status and
comment back. The agent is a teammate you assign work to, not a chat box bolted
onto the side.

It is built on **[Ablo](https://www.abloatai.com/)**, which is what makes that
true. Ablo is the write path and the sync stream: a change applies optimistically,
resolves when the authoritative database has confirmed it, rolls back if it is
rejected, and fans out to everyone watching. Humans and agents go through the
same one, with the same permission model.

- Ablo — [abloatai.com](https://www.abloatai.com/) ·
  [github.com/Abloatai/ablo](https://github.com/Abloatai/ablo)

---

## Stack

| Concern       | Choice                                       | Why                                                        |
| ------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Sync + writes | Ablo                                         | The write path, realtime delivery, and per-session scoping |
| Database      | Neon Postgres                                | Source of truth; Ablo replicates from it                   |
| Migrations    | Drizzle                                      | Owns all DDL — Ablo never migrates                         |
| Identity      | Better Auth                                  | Organizations, teams, invitations                          |
| Agent runtime | eve                                          | The agent `scout` and its tools                            |
| UI            | Next.js 15, React 19, Tailwind v4, shadcn/ui |

---

## Getting started

You need a **Neon** database (or any Postgres with logical replication) and an
**Ablo** account. Both have free tiers.

### 1. Clone and install

```bash
git clone https://github.com/Abloatai/circle-ablo.git
cd circle-ablo
pnpm install
```

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Fill in at minimum `DATABASE_URL`, `DATABASE_URL_POOLED` and
`BETTER_AUTH_SECRET`. Every variable is documented in `.env.example`, including
what breaks while each one is missing.

> `DATABASE_URL` is Neon's **direct** endpoint and `DATABASE_URL_POOLED` is the
> pooled one. Migrations need a real session; request handlers want PgBouncer.
> Ablo registers the direct host — a pooled host fails registration in the same
> words a wrong password would.

### 3. Create the schema

```bash
pnpm db:migrate
```

### 4. Connect Ablo

```bash
npx ablo login
npx ablo dev --branch $(git branch --show-current)   # writes ABLO_API_KEY into .env.local
npx ablo connect                                     # registers the database
npx ablo push                                        # uploads ablo/schema.ts
npx ablo doctor                                      # everything green?
```

### 5. Seed a workspace to look at

```bash
pnpm db:seed
```

This is destructive — it truncates the work tables — and it is only for
development. It creates a workspace with people, teams, ~300 issues, projects,
cycles and saved views. Sign in as any seeded person with the password printed
at the end.

Signing up fresh works too, and provisions a real empty workspace.

### 6. Run it

```bash
pnpm dev
```

To work on the agent as well, in a second terminal:

```bash
npx eve dev
```

The agent needs credit on the [Vercel AI Gateway](https://vercel.com/) to
complete a turn. Its tools, permissions and writes all work without one; the
model call is what needs the balance.

To let Scout inspect private pull requests, register a GitHub App for your
deployment and connect it under **Settings → Integrations**. The app uses
read-only pull-request permission, short-lived installation tokens, and an
explicit repository-to-team mapping. See [DEPLOY.md](DEPLOY.md#3-register-the-github-app)
for the exact URLs, permissions, events, and environment variables.

---

## How it fits together

```
browser ──┬── reads  ── Ablo local pool (live, synchronous in render)
          └── writes ── Ablo ── Neon Postgres
                         ▲
eve agent ───────────────┘   scoped session, minted per run
```

- **Reads** are synchronous reads off a synced local pool (`hooks/use-workspace-data.ts`),
  so they stay reactive in render.
- **Writes** go through Ablo from the browser, and through the server client for
  the few things that need a server (`app/api/issues` allocates the per-team
  issue number race-safely, then writes the issue through Ablo).
- **The agent** gets a session minted per run, scoped to that run's team and
  granted only the operations its tools need. The model never names a team, an
  issue or a capability — it only ever sees a run id.

`ablo/schema.ts` is the contract: which models exist, which sync group each row
fans out on, and how a signed-in person maps to those groups.

---

## Documentation

| File          | What it covers                                                      |
| ------------- | ------------------------------------------------------------------- |
| `DEPLOY.md`   | Production: the Ablo plane, environment, and what the agent accepts |
| `AI_GUIDE.md` | Where each kind of logic lives — orientation for humans and agents  |

---

## Contributing

Issues and pull requests are welcome. Two things worth knowing before you open one:

1. **Verify in two browsers.** Every change to workspace data is an Ablo write,
   and the test is to post in one browser and watch a second that never reloads
   — a reload test passes either way, because the data is usually in the
   database regardless. `AI_GUIDE.md` has the rule and its exceptions.
2. **Follow the Ablo conventions in `AI_GUIDE.md`.** Short, specific rules for
   working with the Ablo API here — how to page a server read, how to narrow one
   by a reference field, how to clear a field. Worth five minutes before your
   first write.

---

## Credits

Circle began as [ln-dev7/circle](https://github.com/ln-dev7/circle), a
Linear-inspired UI template by [lndev-ui](https://lndev.me/) — a front end with
no backend, where every mutation lived in memory. This project keeps that
interface and puts a real multiplayer product underneath it.

MIT licensed. See `LICENSE.md`, which carries both copyright notices.
