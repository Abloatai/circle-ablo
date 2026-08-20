# Circle — where things live

Orientation for anyone, human or agent, changing this codebase. It says where
each kind of logic lives and which seams matter. It deliberately does not repeat
`README.md` (getting started) or `DEPLOY.md` (production).

> This file used to describe Circle as "a pure front-end template… no backend,
> no API, no database and no authentication", which was true of the template it
> started from and has not been true for a long time. If something here looks
> equally stale, it probably is — fix it in the same commit.

---

## The seam that matters

```
components/  ──reads──▶  hooks/use-workspace-data.ts  ──▶  Ablo local pool
     │
     └──writes──▶  hooks/use-*-actions.ts  ──▶  Ablo  ──▶  Neon Postgres
```

Everything else is detail. If you are adding a feature, you are almost always
adding one live read to `use-workspace-data.ts` and one action hook beside the
others.

**Any change to workspace data is an Ablo write.** A write that skips Ablo
reaches nobody and looks fine to the person who made it.

Three things are deliberately not Ablo writes: identity (Better Auth through
Drizzle), `db/seed.ts`, and the per-team issue-number counter in
`app/api/issues`, which needs a transaction to stay race-safe. Everything else
goes through Ablo.

---

## Directory map

| Path                  | Holds                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `ablo/schema.ts`      | The sync contract: models, sync groups, identity roles                |
| `db/schema/`          | Drizzle tables — the source of truth for DDL                          |
| `db/migrations/`      | Generated SQL. Never hand-edit an applied one                         |
| `db/seed.ts`          | Turns `lib/domain/` into real rows. Destructive; development only     |
| `hooks/`              | Live reads (`use-workspace-data`) and one action hook per model       |
| `lib/ablo.ts`         | The browser's Ablo client — reactive, mints its own short-lived token |
| `ablo/index.ts`       | The **server** client. Holds the secret key; never import in a client |
| `lib/session.ts`      | `getViewer()` — the only place a request's scope is decided           |
| `lib/data/hydrate.ts` | Flat synced rows → the object graph the views render                  |
| `app/api/`            | The few things that need a server: sessions, issue numbers, agents    |
| `agent/`              | The eve agent `scout`: tools, instructions, scoped session            |
| `components/common/`  | Feature UI, grouped by domain                                         |
| `components/layout/`  | Shell: sidebar, headers, command palette                              |
| `components/ui/`      | shadcn primitives. Prefer composing over editing                      |
| `store/`              | Zustand — **tab-local state only**: selection, filters, panel open    |
| `lib/domain/`         | Types, the icon registry, new-workspace defaults, and the seed        |
| `lib/features.ts`     | Flags for surfaces that exist but are switched off                    |
| `tests/`              | Playwright: `e2e` drives the real UI, `unit` is pure logic            |

---

## Adding a feature, end to end

Say you want a new kind of row.

1. **Table** in `db/schema/app.ts`. Every table spreads `base`, which carries
   `organizationId`, `abloTenantId`, `createdBy` and timestamps.
2. **Migration**: `pnpm db:generate`, then `pnpm db:migrate`.
3. **Model** in `ablo/schema.ts`. Map `workspaceId` from `organization_id` —
   three models once lacked it and could never be created at all, because the
   column is NOT NULL and Ablo had nothing to put there. Choose `orgScoped` or
   `teamScoped` deliberately: it decides who the row reaches.
4. **Push**: `npx ablo push`. If the table is new it will name the
   `ALTER PUBLICATION` to run; it also needs `REPLICA IDENTITY FULL` and the
   grants in `db/grant-ablo-roles.ts`.
5. **Capability** in `app/api/ablo-session/route.ts`. A capability's operations
   are fixed when the session is minted, so a missing `delete` cannot be worked
   around in the UI.
6. **Live read** in `hooks/use-workspace-data.ts`. Read the model
   unconditionally — a selector that returns early on a missing id subscribes to
   nothing and never updates again.
7. **Action hook** beside the others. Clearing a field is `null`; `undefined` is
   dropped from the payload and leaves the old value.
8. **Verify in two browsers**, neither reloading.
9. **Write the test** in `tests/e2e`, asserting against Postgres rather than the
   screen you just wrote to. Then break the thing on purpose and watch the test
   fail — a test that has never failed is not evidence. Two checks written by
   hand here passed while proving nothing, and one of those was a test written
   for a fix earlier the same day.

---

## Tests

```bash
pnpm test:unit   # pure logic, no server, under a second
pnpm test:e2e    # a production build against the real database
pnpm test        # both
```

`tests/e2e` is integration-first on purpose. Every failure this codebase has
had was a write that _appeared_ to succeed — a component reporting success and
saving nothing, a field saving and reading back empty, a pool wedging — and none
of those is visible to a unit test or to a test that only reads the DOM. So each
one drives the real UI and then asserts against Postgres through
`tests/helpers/db.ts`.

They need a seeded database (`pnpm db:seed`) and the Ablo credentials in
`.env.local`. People are resolved from the database rather than hardcoded, and
sign-in happens once in `tests/global-setup.ts` because Better Auth rate-limits
the endpoint. Anything a test creates, it creates itself and cleans up — no test
deletes a seeded team.

`tests/helpers/ui.ts` carries the interaction traps worth knowing: the issue
context menu opens on the wrapper rather than the link inside it, menu items
carry their shortcut in the accessible name, and controlled inputs need typing
rather than `fill` before a gated submit button enables.

---

## Switched-off surfaces

`lib/features.ts` holds a flag per surface that exists in the tree but is not
on. Reviews and the integrations settings are both off: they render fixtures,
or connect to nothing, and shipping them made the app claim things that were
not true.

Turning one off means both halves. The nav entry stays visible but stops being
a link and says "Coming soon" on hover; the route calls `notFound()`. A disabled
link whose URL still serves the page is not disabled, and there is a test for
each that fails if either half moves without the other.

Nothing is deleted — the work is planned, and a flag is one line to flip.

---

## Ablo conventions

These apply to every new surface. Each is easy to guess wrong.

- **Every mutable model is tenant-scoped.** `tenancy` in `ablo/schema.ts` points
  at `ablo_tenant_id`, kept separate from the `organization_id` Better Auth
  uses. `{ by: 'none' }` is for global reference data, not for application rows.
  Read scope comes from sync groups, not from this column.
- **Clearing a field is `null`.** `undefined` means "leave this alone" and is
  dropped from the payload, so an unassign written as `undefined` keeps the old
  assignee.
- **A server `list()` returns one page of 20.** It is an array, with `hasMore`
  and `nextCursor` as non-enumerable properties. Use `listAll` in
  `agent/lib/circle.ts` to walk the pages. `local.list()` on the reactive client
  is not paged.
- **Narrow server-side reads by reference field in JavaScript.** Server `where`
  is for scalar columns — `id`, `title`, `identifier`, `rank`, `body`,
  `description`, `priority`. For `teamId`, `statusId`, `assigneeId`, `issueId`,
  `projectId`, `authorId` or `workspaceId`, use `listAllWhere` in
  `agent/lib/circle.ts`, which pages through and filters in JavaScript.
  `local.list({ where })` on the reactive client filters the local pool and
  takes reference fields directly — the project update timeline reads that way.
- **`delete()` takes `{ id }`**, not `{ where: { id } }`.
- **Take the organization id from the session, never off a row.**
  `.from()`-mapped fields such as `workspaceId` are populated in Postgres but
  only present on rows that were written through Ablo, not on snapshot-loaded
  ones.
- **After any schema change**: `ablo push`, then `pnpm ablo:reload`, then test a
  write. `ablo doctor` checks infrastructure, not policy. `pnpm db:backfill`
  stamps `ablo_tenant_id` on rows seeded straight into Postgres.

---

## Things that look like state but are not

`store/` is for what belongs to the browser tab: which notification is selected,
which filters are applied, whether a panel is open.
`store/notifications-store.ts` is the model to copy — it holds a selection and
says so.

It is **not** for workspace data. Two stores were deleted rather than fixed for
exactly this reason, and a component that copied its prop into `useState` on
mount rendered a feed that went deaf to every update after it mounted.

---

## The agent

`agent/agent.ts` sets the model. `agent/instructions.md` is the system prompt —
it distinguishes an issue assignment from a conversation, which is what decides
whether the agent uses `post_update` or `reply`.

Tools live in `agent/tools/`, one file per tool, and each starts by calling
`loadRun(runId)`. That is the whole security model: the run row is written by an
already-authenticated request, and the tool derives its scope from it. The model
only ever sees a run id, so nothing it says can widen what it can touch.

`agent/lib/circle.ts` holds the shared pieces — `loadRun`, `listAll` (a server
read is one page of 20), and `listAllWhere` (narrowing a server read by a
reference field, which is done in JavaScript — see **Ablo conventions**
above).
