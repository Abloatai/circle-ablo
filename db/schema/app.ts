/**
 * Circle's work domain, expressed for Postgres.
 *
 * Derived from the shapes in `lib/domain/*`, with three deliberate changes:
 *
 * 1. Icons are not stored. The mock types carry React components
 *    (`Status.icon`, `Project.icon`, `Priority.icon`); the database stores the
 *    id/category and the UI resolves the component from a registry.
 * 2. Denormalised counters are dropped. `Cycle.scope` / `started` / `completed`
 *    are counts over issues, so they are queried, not stored.
 * 3. Reserved names line up with Ablo, which supplies `id`, `createdAt`,
 *    `updatedAt`, `organizationId` and `createdBy` on every model it syncs.
 *
 * Identity (user / organization / team / member) belongs to Better Auth and
 * lives in `db/schema/auth.ts`. This file only references those ids.
 */
import {
   bigint,
   boolean,
   date,
   index,
   integer,
   jsonb,
   pgTable,
   real,
   text,
   timestamp,
   uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organization, team } from './auth';

/* -------------------------------------------------------------------------- */
/*                                  Shared                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every synced row carries these.
 *
 * `organization_id` is the application's tenant — the Better Auth organization.
 * `ablo_tenant_id` is Ablo's, and the two are separate columns because they are
 * separate ideas: Ablo's tenant is the Ablo organization the project belongs
 * to, and pointing Ablo at `organization_id` makes it stamp that id over the
 * app's, putting rows in a workspace the app cannot see.
 *
 * The column is not an isolation boundary — this database belongs to one Ablo
 * organization, so every row holds the same value. It is here because Ablo
 * refuses to commit to a model that is not row-local tenant scoped: without it
 * every write fails with `tenant_model_missing_organization_id`. See
 * ablo/schema.ts.
 */
const base = {
   id: text('id').primaryKey(),
   organizationId: text('organization_id').notNull(),
   abloTenantId: text('ablo_tenant_id'),
   createdBy: text('created_by'),
   createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** `lib/domain/status.tsx` — orders the workflow and drives cycle progress. */
export type StatusCategory =
   | 'triage'
   | 'backlog'
   | 'unstarted'
   | 'started'
   | 'completed'
   | 'canceled';

/** `lib/domain/priorities.tsx` — a fixed scale, so an int rather than a table. */
export type PriorityLevel = 0 | 1 | 2 | 3 | 4; // no-priority → urgent

export type HealthId = 'no-update' | 'on-track' | 'at-risk' | 'off-track';

/* -------------------------------------------------------------------------- */
/*                            Workflow configuration                          */
/* -------------------------------------------------------------------------- */

/**
 * Issue statuses. Per-team when `teamId` is set, otherwise organization-wide,
 * which is how a team gets its own workflow without duplicating the defaults.
 */
export const workflowState = pgTable(
   'workflow_state',
   {
      ...base,
      teamId: text('team_id'),
      name: text('name').notNull(),
      color: text('color').notNull(),
      category: text('category').$type<StatusCategory>().notNull(),
      /** Order within the category. */
      position: real('position').notNull().default(0),
   },
   (t) => [index('workflow_state_org_idx').on(t.organizationId, t.teamId)]
);

/**
 * An issue label, or a group of them.
 *
 * A group is a label row with `is_group` set; the labels inside it point back
 * with `parent_id`. Modelling a group as a label rather than a separate table
 * keeps one namespace — the unique index below already stops a group and a
 * label sharing a name, which would be confusing in every picker.
 *
 * The point of a group is mutual exclusivity: an issue takes at most one label
 * from each group, the way a status or a priority works. A group is never
 * applied to an issue itself.
 */
export const label = pgTable(
   'label',
   {
      ...base,
      name: text('name').notNull(),
      color: text('color').notNull(),
      /** True for a group. Groups hold labels; they are not applied to issues. */
      isGroup: boolean('is_group').notNull().default(false),
      /** The group this label belongs to, if any. */
      parentId: text('parent_id'),
   },
   (t) => [
      uniqueIndex('label_org_name_idx').on(t.organizationId, t.name),
      index('label_parent_idx').on(t.parentId),
   ]
);

/* -------------------------------------------------------------------------- */
/*                          Initiatives → projects                            */
/* -------------------------------------------------------------------------- */

export const initiative = pgTable(
   'initiative',
   {
      ...base,
      name: text('name').notNull(),
      description: text('description'),
      /** Emoji, per `Initiative.icon`. */
      icon: text('icon'),
      status: text('status').$type<'active' | 'planned' | 'completed'>().notNull(),
      priority: integer('priority').$type<PriorityLevel>().notNull().default(0),
      ownerId: text('owner_id'),
      /** Free-text target such as "Q3 2026". */
      target: text('target'),
      health: text('health').$type<HealthId>().notNull().default('no-update'),
   },
   (t) => [index('initiative_org_idx').on(t.organizationId)]
);

export const project = pgTable(
   'project',
   {
      ...base,
      teamId: text('team_id').notNull(),
      name: text('name').notNull(),
      /** One line under the project name. */
      summary: text('summary'),
      /** The project brief, as the same block JSON issues use. */
      description: text('description').notNull().default(''),
      /** Registry key for the icon component, not the component itself. */
      icon: text('icon'),
      statusId: text('status_id').notNull(),
      percentComplete: real('percent_complete').notNull().default(0),
      startDate: date('start_date'),
      targetDate: date('target_date'),
      leadId: text('lead_id'),
      priority: integer('priority').$type<PriorityLevel>().notNull().default(0),
      health: text('health').$type<HealthId>().notNull().default('no-update'),
      healthUpdatedAt: timestamp('health_updated_at', { withTimezone: true }),
      initiativeId: text('initiative_id'),
   },
   (t) => [index('project_org_idx').on(t.organizationId), index('project_team_idx').on(t.teamId)]
);

/**
 * Join rows carry their own id rather than a composite key: Ablo syncs a model
 * by row id, so a composite-key table cannot fan a label change out live.
 */
export const projectLabel = pgTable(
   'project_label',
   {
      ...base,
      teamId: text('team_id'),
      projectId: text('project_id').notNull(),
      labelId: text('label_id').notNull(),
   },
   (t) => [uniqueIndex('project_label_idx').on(t.projectId, t.labelId)]
);

/** `ProjectMilestone` in lib/domain/project-details.ts. */
export const projectMilestone = pgTable(
   'project_milestone',
   {
      ...base,
      teamId: text('team_id'),
      projectId: text('project_id').notNull(),
      name: text('name').notNull(),
      targetDate: date('target_date'),
      done: boolean('done').notNull().default(false),
      position: real('position').notNull().default(0),
   },
   (t) => [index('project_milestone_project_idx').on(t.projectId)]
);

/** The health write-ups on a project's overview. */
export const projectUpdate = pgTable(
   'project_update',
   {
      ...base,
      teamId: text('team_id'),
      projectId: text('project_id').notNull(),
      authorId: text('author_id').notNull(),
      health: text('health').$type<HealthId>().notNull(),
      body: text('body').notNull(),
   },
   (t) => [index('project_update_project_idx').on(t.projectId)]
);

export const projectResource = pgTable(
   'project_resource',
   {
      ...base,
      teamId: text('team_id'),
      projectId: text('project_id').notNull(),
      title: text('title').notNull(),
      url: text('url').notNull(),
   },
   (t) => [index('project_resource_project_idx').on(t.projectId)]
);

/* -------------------------------------------------------------------------- */
/*                                   Cycles                                   */
/* -------------------------------------------------------------------------- */

export const cycle = pgTable(
   'cycle',
   {
      ...base,
      teamId: text('team_id').notNull(),
      number: integer('number').notNull(),
      name: text('name').notNull(),
      status: text('status').$type<'planned' | 'upcoming' | 'current' | 'completed'>().notNull(),
      startDate: date('start_date').notNull(),
      endDate: date('end_date').notNull(),
      /** Percent of team capacity allocated. Scope/progress are counted, not stored. */
      capacity: real('capacity').notNull().default(100),
   },
   (t) => [uniqueIndex('cycle_team_number_idx').on(t.teamId, t.number)]
);

/* -------------------------------------------------------------------------- */
/*                                   Issues                                   */
/* -------------------------------------------------------------------------- */

/**
 * Allocates issue numbers.
 *
 * The counter is per team because the prefix is the team's key, and it lives in
 * its own row so a number can be claimed with a single atomic UPDATE … RETURNING
 * rather than a read-then-write that two people can win at once.
 */
export const issueCounter = pgTable('issue_counter', {
   teamId: text('team_id').primaryKey(),
   organizationId: text('organization_id').notNull(),
   next: integer('next').notNull().default(1),
});

export const issue = pgTable(
   'issue',
   {
      ...base,
      teamId: text('team_id').notNull(),
      /** Human key, e.g. "CORE-123". Unique per organization. */
      identifier: text('identifier').notNull(),
      title: text('title').notNull(),
      description: text('description').notNull().default(''),
      statusId: text('status_id').notNull(),
      /** A user row; an agent is a user whose role is 'Application'. */
      assigneeId: text('assignee_id'),
      priority: integer('priority').$type<PriorityLevel>().notNull().default(0),
      cycleId: text('cycle_id'),
      projectId: text('project_id'),
      parentIssueId: text('parent_issue_id'),
      /** A milestone of the issue's project. */
      milestoneId: text('milestone_id'),
      /** LexoRank string; board and list ordering already rely on it. */
      rank: text('rank').notNull(),
      /**
       * Label ids, held on the issue rather than in a join table. A label set is
       * a handful of ids that only ever change with the issue itself, so this
       * keeps a label change a single confirmed write instead of a second
       * synced model with its own fan-out.
       */
      labelIds: jsonb('label_ids').$type<string[]>().notNull().default([]),
      dueDate: date('due_date'),
      completedAt: timestamp('completed_at', { withTimezone: true }),
   },
   (t) => [
      uniqueIndex('issue_identifier_idx').on(t.organizationId, t.identifier),
      index('issue_team_status_idx').on(t.teamId, t.statusId),
      index('issue_assignee_idx').on(t.assigneeId),
      index('issue_cycle_idx').on(t.cycleId),
      index('issue_project_idx').on(t.projectId),
   ]
);

/**
 * Relationships between issues: what blocks what, and what merely relates.
 *
 * A row is directional — `issue` blocks `relatedIssue` — and the reverse view
 * is a query rather than a second row, so the two can never disagree.
 */
export const issueLink = pgTable(
   'issue_link',
   {
      ...base,
      teamId: text('team_id'),
      issueId: text('issue_id').notNull(),
      relatedIssueId: text('related_issue_id').notNull(),
      type: text('type').$type<'blocks' | 'related' | 'duplicates'>().notNull(),
   },
   (t) => [
      uniqueIndex('issue_link_idx').on(t.issueId, t.relatedIssueId, t.type),
      index('issue_link_related_idx').on(t.relatedIssueId),
   ]
);

export const comment = pgTable(
   'comment',
   {
      ...base,
      teamId: text('team_id'),
      issueId: text('issue_id').notNull(),
      authorId: text('author_id').notNull(),
      body: text('body').notNull(),
      /** Set for a threaded reply. */
      parentCommentId: text('parent_comment_id'),
      reactions: jsonb('reactions').$type<Record<string, string[]>>().notNull().default({}),
   },
   (t) => [index('comment_issue_idx').on(t.issueId)]
);

/** The activity feed on an issue: status changes, assignments, links. */
export const issueActivity = pgTable(
   'issue_activity',
   {
      ...base,
      teamId: text('team_id'),
      issueId: text('issue_id').notNull(),
      actorId: text('actor_id').notNull(),
      type: text('type').notNull(),
      payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
   },
   (t) => [index('issue_activity_issue_idx').on(t.issueId)]
);

/* -------------------------------------------------------------------------- */
/*                            Documents and views                             */
/* -------------------------------------------------------------------------- */

export const documentFolder = pgTable(
   'document_folder',
   {
      ...base,
      teamId: text('team_id').notNull(),
      name: text('name').notNull(),
      icon: text('icon'),
   },
   (t) => [index('document_folder_team_idx').on(t.teamId)]
);

export const document = pgTable(
   'document',
   {
      ...base,
      teamId: text('team_id').notNull(),
      folderId: text('folder_id'),
      title: text('title').notNull(),
      icon: text('icon'),
      content: text('content').notNull().default(''),
   },
   (t) => [index('document_team_idx').on(t.teamId)]
);

/**
 * A pull request someone attached to an issue.
 *
 * Not a GitHub integration — there isn't one. This is a link a person pasted,
 * with the state they set, which is what the panel used to fabricate. Modelling
 * it this way keeps the section honest: every row here is something a human
 * actually put there.
 */
export const issuePullRequest = pgTable(
   'issue_pull_request',
   {
      ...base,
      teamId: text('team_id').notNull(),
      issueId: text('issue_id').notNull(),
      url: text('url').notNull(),
      title: text('title').notNull(),
      state: text('state')
         .$type<'open' | 'merged' | 'closed' | 'draft'>()
         .notNull()
         .default('open'),
   },
   (t) => [index('issue_pull_request_issue_idx').on(t.issueId)]
);

/* -------------------------------------------------------------------------- */
/*                              GitHub App                                    */
/* -------------------------------------------------------------------------- */

/**
 * One GitHub App installation connected to one Circle workspace.
 *
 * App credentials stay in the deployment environment. Only GitHub's opaque
 * installation id is persisted, so a database leak is not an API credential.
 */
export const githubInstallation = pgTable(
   'github_installation',
   {
      id: text('id').primaryKey(),
      organizationId: text('organization_id')
         .notNull()
         .references(() => organization.id, { onDelete: 'cascade' }),
      installationId: bigint('installation_id', { mode: 'number' }).notNull(),
      accountId: bigint('account_id', { mode: 'number' }).notNull(),
      accountLogin: text('account_login').notNull(),
      accountType: text('account_type').notNull(),
      repositorySelection: text('repository_selection').notNull(),
      createdBy: text('created_by').notNull(),
      suspendedAt: timestamp('suspended_at', { withTimezone: true }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => [
      uniqueIndex('github_installation_installation_uidx').on(t.installationId),
      index('github_installation_org_idx').on(t.organizationId),
   ]
);

/** Repositories currently granted to an installation, optionally assigned to a team. */
export const githubRepository = pgTable(
   'github_repository',
   {
      id: text('id').primaryKey(),
      installationId: text('installation_id')
         .notNull()
         .references(() => githubInstallation.id, { onDelete: 'cascade' }),
      githubRepositoryId: bigint('github_repository_id', { mode: 'number' }).notNull(),
      owner: text('owner').notNull(),
      name: text('name').notNull(),
      fullName: text('full_name').notNull(),
      htmlUrl: text('html_url').notNull(),
      private: boolean('private').notNull(),
      enabled: boolean('enabled').notNull().default(true),
      teamId: text('team_id').references(() => team.id, { onDelete: 'set null' }),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => [
      uniqueIndex('github_repository_installation_repo_uidx').on(
         t.installationId,
         t.githubRepositoryId
      ),
      index('github_repository_team_idx').on(t.teamId),
      index('github_repository_full_name_idx').on(t.fullName),
   ]
);

/** GitHub delivery ids make webhook handling idempotent across retries. */
export const githubWebhookDelivery = pgTable('github_webhook_delivery', {
   id: text('id').primaryKey(),
   event: text('event').notNull(),
   receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Saved views. `filters` mirrors the shape the filter store already builds. */
export const savedView = pgTable(
   'saved_view',
   {
      ...base,
      teamId: text('team_id'),
      name: text('name').notNull(),
      icon: text('icon'),
      description: text('description'),
      filters: jsonb('filters').$type<Record<string, unknown>>().notNull().default({}),
      /** Null = private to `createdBy`. */
      sharedWithTeamId: text('shared_with_team_id'),
   },
   (t) => [index('saved_view_org_idx').on(t.organizationId)]
);

/* -------------------------------------------------------------------------- */
/*                                   Inbox                                    */
/* -------------------------------------------------------------------------- */

export const notification = pgTable(
   'notification',
   {
      ...base,
      /** Recipient. */
      userId: text('user_id').notNull(),
      type: text('type').notNull(),
      issueId: text('issue_id'),
      actorId: text('actor_id'),
      readAt: timestamp('read_at', { withTimezone: true }),
      snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
   },
   (t) => [index('notification_user_idx').on(t.userId, t.readAt)]
);

/* -------------------------------------------------------------------------- */
/*                              Per-person marks                              */
/* -------------------------------------------------------------------------- */

/**
 * A thing someone starred.
 *
 * Deliberately generic — `entity_type` plus `entity_id` rather than a nullable
 * column per kind — because the sidebar's Favorites section mixes issues,
 * projects, cycles, views and documents in one list, and a table per kind would
 * make that list a union of five queries.
 *
 * There is no foreign key for the same reason. What it points at is checked by
 * resolving the id against the synced pool; a favourite whose target is gone
 * simply does not render.
 */
export const favorite = pgTable(
   'favorite',
   {
      ...base,
      /** Whose favourite. Only this person ever syncs the row. */
      userId: text('user_id').notNull(),
      /** `issue` | `project` | `cycle` | `document` | `view` | `team` */
      entityType: text('entity_type').notNull(),
      entityId: text('entity_id').notNull(),
   },
   (t) => [
      // Starring twice is the same fact, and the toggle relies on there being
      // at most one row to delete.
      uniqueIndex('favorite_user_entity_idx').on(t.userId, t.entityType, t.entityId),
      index('favorite_user_idx').on(t.userId),
   ]
);

/**
 * Someone watching a thing, so that changes to it reach their inbox.
 *
 * Same shape as `favorite` and a deliberately different scope. A favourite is
 * private; a subscription is not, because the person writing a comment has to
 * know who else is watching in order to notify them, and that write happens in
 * their browser. Trackers show subscribers on the issue for the same reason.
 */
export const subscription = pgTable(
   'subscription',
   {
      ...base,
      /** Who is watching. */
      userId: text('user_id').notNull(),
      /** `issue` | `team` | `project` */
      entityType: text('entity_type').notNull(),
      entityId: text('entity_id').notNull(),
   },
   (t) => [
      uniqueIndex('subscription_user_entity_idx').on(t.userId, t.entityType, t.entityId),
      index('subscription_entity_idx').on(t.entityType, t.entityId),
   ]
);

/* -------------------------------------------------------------------------- */
/*                                   Agents                                   */
/* -------------------------------------------------------------------------- */

/**
 * One eve run. Created when work is handed to an agent, updated by the agent
 * as it goes, so the UI can show progress without polling the agent runtime.
 */
export const agentRun = pgTable(
   'agent_run',
   {
      ...base,
      /** The 'Application' user the work is assigned to. */
      agentUserId: text('agent_user_id').notNull(),
      /** Who handed it over. */
      requestedById: text('requested_by_id').notNull(),
      issueId: text('issue_id'),
      teamId: text('team_id').notNull(),
      status: text('status')
         .$type<'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'canceled'>()
         .notNull()
         .default('queued'),
      /** eve session id, for resuming the conversation and reading its trace. */
      sessionId: text('session_id'),
      prompt: text('prompt').notNull(),
      /** Short human-readable line: "searching SMR permit filings". */
      currentStep: text('current_step'),
      result: text('result'),
      error: text('error'),
      startedAt: timestamp('started_at', { withTimezone: true }),
      finishedAt: timestamp('finished_at', { withTimezone: true }),
   },
   (t) => [
      index('agent_run_issue_idx').on(t.issueId),
      index('agent_run_team_idx').on(t.teamId, t.status),
   ]
);

/**
 * Durable messages between agents and people, per Ablo's agent-messaging guide:
 * claim descriptions are ephemeral, so anything that must survive a reconnect
 * or be read by an HTTP-transport agent is a row.
 */
export const agentMessage = pgTable(
   'agent_message',
   {
      ...base,
      teamId: text('team_id').notNull(),
      runId: text('run_id'),
      /** User id of a person, or the agent's 'Application' user id. */
      authorId: text('author_id').notNull(),
      kind: text('kind').$type<'status' | 'request' | 'handoff' | 'result'>().notNull(),
      body: text('body').notNull(),
      /** Causal link back to the row being worked on. */
      aboutEntityType: text('about_entity_type'),
      aboutEntityId: text('about_entity_id'),
      /** The Ablo claim id this message is about, when there is one. */
      aboutClaimId: text('about_claim_id'),
   },
   (t) => [index('agent_message_team_idx').on(t.teamId)]
);
