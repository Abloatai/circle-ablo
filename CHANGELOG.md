# Changelog

Notable changes to Circle. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the major version is `0`, the public surface — the Ablo schema, the
capability grants in `app/api/ablo-session`, and the agent's tool contract — may
change in a minor release.

## [Unreleased]

Nothing yet.

## [0.2.0]

The five surfaces that were left disabled at 0.1.0, and the bug behind every
mysterious stall in development.

### Added

- **Favourites.** Star an issue and it appears in a Favorites group in the
  sidebar. The group resolves each row against the synced pool rather than
  storing a name, so renaming an issue renames it there, and a favourite whose
  target is gone stops rendering instead of becoming a dead link. Private —
  the model is scoped to the person, so nobody sees anyone else's.
- **Subscriptions**, on issues and on teams, and they do something: a
  subscriber is notified when someone comments, even with no other connection
  to the issue. My issues → Subscribed filters on real subscriptions instead
  of falling back to "issues I am involved in", which had made it a duplicate
  of Activity.
- **Leave a team, leave a workspace**, both with a confirmation that says what
  changes. Leaving a workspace keeps everything you wrote exactly where it is.
- **Retire a team** — it keeps all its history and stays readable, and only
  stops taking new issues. Reversible, and enforced server-side rather than by
  hiding a button.
- **Delete a team**, which clears eighteen tables in one transaction. It names
  the real counts and asks for the team's name to be typed.
- **Label groups.** An issue takes at most one label from a group, the way it
  has one status — applying a label replaces whichever sibling was there.
  Groups are headings in the pickers, never applied to issues themselves.

### Fixed

- **The connection pool wedged permanently after a dead client.** Sign-in
  returned 500 after exactly ten seconds while a fresh script reached the same
  endpoint in under two, and only a restart cleared it. The pool was wrapped in
  a `Proxy` with only a `get` trap; `pg-pool` prunes a dead connection by
  assigning `this._clients = this._clients.filter(...)`, so the new array
  landed on the proxy's throwaway target and `_clients` never shrank. The pool
  believed it was permanently full and every checkout queued until the timeout.
- **`pnpm db:migrate` never loaded `.env.local`**, so the third step of the
  README failed for anyone setting the project up.
- **The profile page showed the wrong person** — it read `members[0]` rather
  than the signed-in user, so everyone saw the same stranger's name and avatar.

### Changed

- The team danger zone no longer promises a "30-day restoration window" for
  deletion. There is none, so it now says there is no undo and points at
  retiring instead.

## [0.1.0]

The first release. Circle was a Linear-inspired front end with no backend, where
every mutation lived in a Zustand store; this is the version where it became a
multiplayer product with an agent in it.

### Added

- **Realtime multiplayer writes on Ablo.** Every list reads live off a synced
  local pool, and every change to workspace data is an Ablo write — optimistic
  locally, confirmed against the authoritative database, delivered to everyone
  watching the same sync group.
- **An agent that is a teammate.** Assign an issue to `scout` and it reads the
  issue and its discussion, comments, and moves the status. Ask it a question on
  the agent page and it reads the team's issues to answer. It works through the
  same Ablo write path people do, on a session minted per run and scoped to that
  run's team — the model only ever sees a run id.
- **Identity and workspaces** via Better Auth: sign-up, sign-in, organizations,
  teams, and the full invitation flow through to accepting one.
- **Write paths for every model**: issues (including delete, sub-issues, links
  and attached pull requests), comments (edit, delete, reactions), projects and
  their milestones, resources and updates, initiatives, cycles, labels, saved
  views, documents and folders, and the workflow states themselves.
- **Live presence** — who is in the workspace and what they are looking at.
- **Per-recipient notifications** for comments, assignment and mentions.
- **Pull request links that resolve themselves** from GitHub, including merged
  and draft states, without a token in the browser.
- `DEPLOY.md`, and an `.env.example` that documents what breaks while each
  variable is missing.

### Changed

- **Drizzle owns all DDL.** Ablo never migrates; the schema is `db/schema/` and
  the contract is `ablo/schema.ts`.
- **Request handlers use Neon's pooled endpoint**, with real timeouts.
  `connectionTimeoutMillis` defaults to 0 in `pg`, which turns an unavailable
  connection into a request that waits forever at 0% CPU rather than an error.
- Web search runs through Exa on the Vercel AI Gateway.

### Removed

- `store/issues-store.ts` and `store/project-updates-store.ts`, deleted rather
  than fixed — a mock-seeded store with a mutation on it is how the next surface
  gets wired to it by accident.
- The mock agent chat, which answered from keyword-matched canned text while the
  real agent worked elsewhere.
- Template branding, funding links and metadata belonging to the project this
  began as.

### Fixed

Each of these was silent rather than loud, which is why it is worth naming:

- **Four surfaces wrote to memory and reported success** — the command palette,
  the issue context menu, the project update composer, and the issue activity
  feed. The last copied its prop into `useState` on mount and went deaf to every
  update afterwards, which no reload test could catch.
- **Signing up produced an unusable workspace.** Its statuses and labels were
  written without Ablo's tenancy column, so they could never reach a client and
  the new member could not create an issue at all.
- **The agent could not see a single status**, because its session was scoped to
  a team while `workflowState` is org-scoped — so `set_status` was unreachable.
- **The agent read an empty discussion on every run**, having narrowed a server
  read by a reference field. It uses `listAllWhere` now — see `AI_GUIDE.md`.
- **The new-issue dialog reset itself in a loop**, discarding a draft whenever
  anyone touched a workflow state.
- **Three models could never be created**, having no field mapped to a NOT NULL
  `organization_id`.
- Sixteen links hardcoded the workspace slug, so they navigated to a workspace
  that only existed in the seed.

[unreleased]: https://github.com/Eagardh/circle-powered-by-ablo/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Eagardh/circle-powered-by-ablo/releases/tag/v0.2.0
[0.1.0]: https://github.com/Eagardh/circle-powered-by-ablo/releases/tag/v0.1.0
