# Circle compatibility fixture for Lobby

This adapts Circle 536701dda31e864ac6b297c619ba5df02fc26b7a for the Lobby
authenticated-source experiment (ABL-1074). It is an adapted application, not a
successful reproduction of the unchanged snapshot. Nothing here deploys Circle.

## Runtime and credentials

The fixture uses published Ablo 0.66.14, React 19.2.8 and Next 16.4.0; install
the committed lock with `pnpm install --frozen-lockfile`. Next 15.2's bundled React
lacked the SDK's `useEffectEvent` dependency even after upgrading React itself.
The build keeps the previous webpack path explicitly. Next 16 removed `next
lint`, so lint now invokes the existing ESLint configuration directly.

Better Auth owns application identity and membership in Postgres. Set
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and server-only
`ABLO_API_KEY` for an actual acceptance run. Use a fresh disposable database and
Ablo branch. For an isolated backend, set server-side `ABLO_API_URL` and
build-time `NEXT_PUBLIC_ABLO_API_URL` to the same reachable backend. The browser
URL is public configuration; never place the API key in a `NEXT_PUBLIC_` variable.
Omitting these URLs retains SDK endpoint defaults.

The application migrations currently leave some tenant/team columns nullable
and omit indexes required by the declared Ablo schema. The acceptance harness
adds these constraints to an empty fixture before schema activation. This is not
an existing-data migration: backfill tenant/team values and review index creation
before applying constraints to populated databases. Schema planner rejection
must not be bypassed.

`db/seed.ts` clears application tables: never run it against an
existing customer's database. It now supplies project-label team IDs.

`ablo/index.ts` owns the privileged data client and separate session issuer.
The session route still checks origin and authentication, derives groups from
server-side membership and grants the existing operation allowlist. Agent
issuance retains its narrower run-derived grants. The browser obtains short-lived
credentials through `session.endpoint`; it never receives the issuer key.
Authentication failures must remain failures, not fallback privileged access.
The issue-create route validates the requested team and relations, then mints a
short-lived user credential granting only `issue.create` in that team. Its client
is disposed after the write. Project credentials alone do not authorize writes
to arbitrary row subjects. Other server-side mutating flows remain unverified.

Each schema model has an organization, team or user subject in addition to the
Ablo tenant column. Serialization tests verify those subjects survive the released
SDK. This is not evidence of enforcement: run the negative access test below.
Membership changes and session expiry/revocation still require runtime checks.

## React and presence

Actions use `useAbloClient()`; rendering selectors continue to use `useAblo()`.
Presence consumes the SDK's session/activities projection, collapses an actor's
multiple sessions to its latest activity and resolves issue UUIDs to identifiers.
Issue and project pages announce reads of actual records through `usePresence`;
hidden tabs unmount those reads, letting the SDK release their leases.

This no longer broadcasts arbitrary route labels for list/settings screens.
An absent peer means no visible record activity, not proof they disconnected.
The existing presence display still uses online/offline language; changing that
copy and demonstrating real browser lease cleanup remain acceptance work.
Presence grants no authorization and is not a write lock.

## Verification and remaining gate

Run `pnpm exec tsc --noEmit`, `pnpm test:unit` and `pnpm build`. The unit suite
includes serialization and multiple-session presence regressions. Full lint is
not established by these checks. UI presence has not been browser-verified.

For actual acceptance, run the existing `create-issue.spec.ts` plus
`lobby-access.spec.ts` against the isolated configured services. The latter
requires both an authorized issue and an issue in a team outside the user's
membership; it checks anonymous/cross-origin mint rejection and direct-ID/list
denial. Do not omit either fixture to make a run pass.

The create-issue test polls the actual PostgreSQL row for up to 60 seconds after
submission, retaining its team, count and peer-browser assertions. A fixed
eight-second sleep failed during cold dev-server compilation of `/api/issues`:
the browser trace still had an unfinished POST when the row assertion ran.
A polling timeout remains a test failure; this is not a relaxed persistence check.

The prior hosted run failed because initial snapshots appended Postgres column
names without schema field mapping. The correction is
[Ablo PR #55](https://github.com/Abloatai/monorepo/pull/55), not a deployed dependency.
The isolated scoped-session test passes anonymous/cross-origin rejection and
foreign-team ID/filter denial, with an allowed issue read as a positive control.
The October 14 isolated baseline also passed the existing create-issue test:
real sign-in, a persisted Postgres row, and appearance in a second authenticated
browser without reloading. Foreign-team issue creation returned 403. This uses
the corrected backend source build and real test-harness HTTP/WebSocket routes,
with fresh Postgres and Redis; it is not a released/deployed-backend proof.
Repeat against mounted
source during accepted edits and reconnects; this migration alone establishes no
mount latency, writable-mount behavior or model-agent performance claim.


## Accepted source changes and reconnects

`tests/e2e/lobby-source-live.spec.ts` is an opt-in check for the isolated Lobby
source-control harness. Set `LOBBY_CONTROL_URL` and `LOBBY_CONTROL_TOKEN` in the
Playwright process; without them the test is explicitly skipped. These are test
bridge settings, not application endpoints or browser configuration. The bridge
must authenticate `/edit?label=...`, `/pause` and `/resume`, apply edits through
native claims and durable acceptance, and disconnect/reconnect the mounted
source feed. Use a disposable copy: this test changes the issue button label
and restores it on success. A failed run can leave the fixture label changed.

Run the app with `next dev --webpack` on the mounted copy and execute:

```sh
pnpm exec playwright test tests/e2e/create-issue.spec.ts tests/e2e/lobby-access.spec.ts tests/e2e/lobby-source-live.spec.ts --project=e2e
```

The live check observes an accepted label change in two authenticated browsers,
keeps the old label during a source-feed disconnection despite a second accepted
version, then verifies catch-up after reconnect. It checks zero new main-frame
document requests and unchanged document markers/time origins; same-document
router events do not count as reloads. It then creates an issue through the
updated control and verifies persistence, team, count and delivery to the peer.

All three tests passed in the October 15 isolated mounted run, with real Redis
leases and native durable source acceptance. Typechecking passed as well. The
control operations were scripted, with one application VM and two browser
contexts; this is not a new model-agent or whole-network-partition result.
Detailed measurements and runtime limitations are maintained in
[Lobby PR #21](https://github.com/Abloatai/lobby/pull/21). Cold dev compilation and
multi-second hot refresh remain visible performance costs.
