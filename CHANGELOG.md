# Changelog

Notable changes to Circle. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the major version is `0`, the public surface — the Ablo schema, the
capability grants in `app/api/ablo-session`, and the agent's tool contract — may
change in a minor release.

## [Unreleased]

Nothing yet.

## [0.5.3]

This release makes an assigned agent something you can talk to: reply in the
issue comments and the run you already have picks the conversation back up.

### Added

- **A comment on an issue an agent is assigned to reaches the agent.** Posting a
  reply wakes its session and asks it to read the discussion again, so a
  follow-up question or a correction lands in the run that is already open
  instead of needing a fresh assignment. The comment stays the source of truth:
  the route takes a comment id, re-reads it under your workspace and team, and
  never trusts text from the browser. Only the latest run resumes, and a failed
  or canceled one is left alone.

### Changed

- **Agent comments render as Markdown.** The agent writes headings, lists and
  code fences, and the activity feed flattened them into one run of text.
  Images and raw HTML are disallowed and links are checked, because agent output
  is untrusted text. The renderer is loaded only when an agent has commented, so
  a discussion between people does not pay for it.

### Fixed

- **The assignee avatar in the issue properties panel could not assign.** It
  opened a picker with no issue or team to write to, so every choice was
  discarded — including picking an agent, which is how a run gets dispatched.

## [0.5.2]

This release updates Circle to Ablo 0.56 and tightens the boundaries between
workspaces and teams.

### Fixed

- **Workspace membership is checked wherever a session, issue or agent run
  crosses a boundary.** A stale active workspace can no longer select an
  organization the viewer has left; issue creation rejects statuses, assignees,
  projects, cycles, parent issues and labels from outside the active workspace
  or team; and chat and dispatch only select agents that belong to that team.
- **Browser sessions can no longer create agent runs or messages directly.**
  Those records are created by the server routes that validate the viewer,
  workspace and team first.

### Changed

- **Ablo is upgraded from 0.55 to 0.56.0.** The runtime, CLI and Humans package
  are pinned to the same version, with the lockfile updated alongside them.

## [0.5.1]

Ablo calls itself "claim, change, confirm". This codebase did the change part
and had a single `claim()` call in it, so the coordination Ablo exists to
provide went mostly unused. This release uses it where it belongs and fixes
what that audit turned up.

### Fixed

- **A retried agent tool call wrote twice.** eve retries when a connection
  drops, and four writes created a row with a fresh id each time — so the
  retry was a second comment, a second notification, a duplicate "changed
  status to X" in the activity feed, or a duplicate reply in the agent chat.
  All four carry an idempotency key now, derived from the run and the content,
  so one run posting two genuinely different updates still gets two.
- **A finished agent run kept advertising the step it stopped on.** It cleared
  `currentStep` with `undefined`, which is dropped from the payload rather than
  written. Runs already affected were cleared too — fixing a write does not
  repair the rows it already made.

### Changed

- **The title and description editors claim the field while you are in them.**
  These are the two places with a gap between reading a value and writing it
  back: the text is read into a draft, the person types for a while, and the
  write lands on blur. An agent rewriting the same field in between used to be
  overwritten by that blur — `EditableTitle` documented it, "their version wins
  unless this tab has unsaved edits". The claim is released on blur, on cancel
  and on unmount, and fails fast rather than queueing, so a text box never
  freezes behind whoever is holding it.

   Writes made from a picker deliberately take no claim. Their value is decided
   when the call is made, and Ablo merges at field level, so a person setting a
   status and an agent setting a priority already both land.

- **The agent's status change claims one field rather than the row**, so
  someone retitling an issue and an agent moving its status no longer wait for
  each other.
- **The agent's status change carries its read as a premise.** It reads the
  workflow states through Ablo's `context()`, so a status renamed or removed
  between the model choosing one and the write landing rejects the write rather
  than pointing at something that moved.

## [0.5.0]

### Added

- **Every workspace gets an agent.** Only the seed used to create one, so
  handing an issue to an agent — the product's headline capability — existed in
  the demo data and nowhere else. Anyone who signed up got a workspace where
  the assignee picker listed only themselves. Provisioning creates `scout`
  alongside the default statuses and labels now.

## [0.4.0]

### Added

- **Tests.** Nineteen integration tests driving the real UI against a
  production build and asserting against Postgres, plus a handful of unit
  tests. `pnpm test:unit` runs in under a second; `pnpm test:e2e` needs a
  seeded database and Ablo credentials, so it is a pre-release step rather
  than a CI one. `AI_GUIDE.md` says what they cover and why they are
  integration-first.
- **Creating an issue is findable.** The button says "New issue" instead of
  being an unlabelled pencil, `C` opens the dialog, and a team with no issues
  offers to create the first one — which is what a workspace shows immediately
  after signing up.
- **A team description**, edited in place on the team overview. `team.description`
  is a new column.
- The team overview shows live open and total issue counts, and the team's
  cycles.

### Fixed

- **The team overview was mostly scenery.** Team resources listed the
  documents fixture, so every team showed the same documents and none of them
  its own; "Add a description..." was that literal string; two icon buttons had
  no handler; "Views" linked to `#`; "Team settings" went to the workspace's
  settings rather than the team's; and a missing team fell through to the first
  one in the list, showing another team's name, members and documents under
  this team's URL.
- **The Views page named a workspace nobody was in.** Its header row read
  "LN · LNDev UI · Workspace" in every workspace — both the badge and the name
  were baked in from the template this began as. The same leftover is gone from
  seven settings files that offered to sync your calendar to "LNDev UI" or
  named the agent "LNDev Agent".

### Changed

- **The Reviews section is switched off** behind `REVIEWS_ENABLED`. It rendered
  an 1185-line fixture — hand-written diffs, invented commit SHAs, the same six
  pull requests for everyone — while every other list in Circle reads live.
  Making it real means real Git data, which is a project rather than a fix.
- **Integrations and Connected accounts are switched off** behind
  `INTEGRATIONS_ENABLED`. Neither connects to anything, and Connected accounts
  went further by listing a GitHub account named "octo-relay" with a Connected
  badge — asserting a link that has never existed.

   What is real: pasting a pull request URL onto an issue resolves its title and
   state from GitHub. There is nothing to connect and no repository to choose —
   the repo is whichever the pasted URL names.

## [0.3.0]

### Added

- **A job title on your profile**, saved from profile settings. `user.title` is
  a new column.

### Fixed

- **The profile page's fields did not save.** Full name, Title and Username
  were inputs with a `defaultValue` and no handler: you could type into them
  and tab away, and the text was gone on the next load. Full name and Title are
  controlled now and save on blur through Better Auth. Identity is Better
  Auth's rather than Ablo's, so the change does not appear live in another
  browser the way workspace data does — it survives a reload, which is the
  right test for this one.

### Changed

- **Username on the profile is disabled rather than editable.** Nothing in the
  app resolves a handle — there are no `@mentions` — so saving one would store
  text that nothing reads.
- The README no longer opens with the contributor rule about Ablo writes. The
  rule and its deliberate exceptions live in `AI_GUIDE.md`, which is where
  someone changing the code will be.

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

[unreleased]: https://github.com/Eagardh/circle-ablo/compare/v0.5.3...HEAD
[0.5.3]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.5.3
[0.5.2]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.5.2
[0.5.1]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.5.1
[0.5.0]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.5.0
[0.4.0]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.4.0
[0.3.0]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.3.0
[0.2.0]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.2.0
[0.1.0]: https://github.com/Eagardh/circle-ablo/releases/tag/v0.1.0
