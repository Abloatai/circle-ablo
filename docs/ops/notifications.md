# Issue notifications

`POST /api/issues/notifications` owns delivery after a saved comment or assignment.
The browser sends a comment ID or issue ID; it cannot supply recipients, tenant,
actor, or notification content. Browser credentials retain their existing
user-private notification scope. Server delivery writes Postgres rows, which the
configured Ablo source replicates to the authorized recipient streams.

The endpoint rejects cross-origin requests, requires the current Better Auth
viewer, validates the event shape, and checks the issue's organization and team
membership. Comment requests must identify a persisted comment authored by that
viewer. Assignment requests concern the issue's current persisted assignee;
the picker waits for the assignment write to succeed before requesting delivery
or starting an agent. Notification delivery does not itself assign an issue.

The server derives comment recipients from the assignee, creator, prior
commenters, and issue/team subscriptions. It excludes the actor and restricts
delivery to current members of the issue's team and organization. Membership
revocation therefore removes eligibility when delivery is evaluated. It never
widens browser grants to another user's notification stream.

Notification IDs bind the recipient to the comment ID, or to the current issue
revision for assignments. Repeated delivery requests use `ON CONFLICT DO NOTHING`.
Later changes produce different assignment revisions; replaying an old comment
does not create duplicate notifications for the same recipient.

Delivery is best-effort after the underlying change. A failed request leaves the
saved comment/assignment intact and shows a warning. There is no durable outbox
or automatic retry guarantee. Existing `DATABASE_URL` (or `DATABASE_URL_POOLED`),
Better Auth configuration, and Ablo source replication are required; there are
no new secrets or public configuration switches.

Verify with `tests/e2e/subscriptions.spec.ts` for subscriber delivery, duplicate
requests, and denied anonymous/cross-origin/forged/inaccessible requests, and
`tests/e2e/issue-assignment.spec.ts` for persisted assignment before agent dispatch.
These run against the isolated fixture described in [Lobby acceptance](lobby-acceptance.md).
Agent dispatch is intercepted in the assignment test; it is not model execution.
