/**
 * The Ablo contract: which rows humans and agents coordinate on.
 *
 * Derived from `db/schema/app.ts` (via `ablo pull drizzle`), then given the two
 * things a pull cannot infer:
 *
 * - **identityRoles** — how a signed-in person maps to sync groups. The sources
 *   are the fields Better Auth's organization plugin puts on the session, so a
 *   member automatically sees their org and their teams and nothing else.
 * - **groups** — which group each row fans out on. Team-scoped rows name their
 *   team; rows that live inside another row (a comment, a milestone) inherit
 *   through a `parent` relation instead.
 *
 * Identity itself (user / organization / team / member) is NOT modelled here.
 * Better Auth owns those tables and writes them directly, so they stay in the
 * ORM and are loaded server-side; only work data is coordinated.
 */
import {
   defineSchema,
   entityRole,
   field,
   identityRole,
   model,
   relation,
   z,
} from '@abloatai/ablo/schema';

/**
 * The table each model maps to is always spelled out: the model names are
 * camelCase for the client API (`ablo.workflowState`), while the columns and
 * tables Drizzle created are snake_case.
 */
/**
 * Model names are camelCase because they are the client API (`ablo.issue`,
 * `ablo.workflowState`); the tables Drizzle created are snake_case. Every model
 * names its table explicitly rather than relying on a conversion.
 */
/**
 * Ablo's tenancy column is its own, not the application's.
 *
 * It is pointed at `ablo_tenant_id` rather than the default `organization_id`,
 * which this schema already uses for the Better Auth organization: Ablo stamps
 * its own organization id into whatever column it is given, so sharing the
 * column puts app rows in a workspace the app cannot see.
 *
 * This column isolates nothing. The database belongs to exactly one Ablo
 * organization, so every row carries the same value and the filter passes for
 * all of them. It is here because **a mutable model must be row-local tenant
 * scoped or Ablo refuses the commit** — `{ by: 'none' }` marks a model as
 * global reference data, and every write to it fails with
 * `tenant_model_missing_organization_id`. That is the whole reason it exists;
 * switching it off cost the app every write path.
 *
 * Sync groups route live delivery but are not the authorization boundary for
 * HTTP reads. This deployment therefore requires one Ablo organization per
 * customer before it can be treated as a hard multi-tenant boundary. The
 * Better Auth membership check in /api/ablo-session still derives every group
 * server-side and prevents a stale active organization from minting access.
 *
 * The secret key is the exception, and is meant to be. `sync` in `ablo/index.ts`
 * holds `ABLO_API_KEY` and can mint a session with any groups it likes, which is
 * what lets the server allocate issue numbers and run agents. Keep it server-
 * side; it is as privileged as `DATABASE_URL`.
 *
 * One Ablo organization per customer — minted with the `organization:act-as`
 * scope — is the stronger form, worth reaching for if this ever hosts customers
 * under separate contracts. It is not what stands between two workspaces here.
 */
const tenancy = { by: 'column', column: 'ablo_tenant_id' } as const;

const orgScoped = (tableName: string) => ({
   tableName,
   policy: tenancy,
   groups: { roles: [entityRole({ kind: 'org', source: 'workspaceId' })] },
});

const teamScoped = (tableName: string) => ({
   tableName,
   policy: tenancy,
   groups: { roles: [entityRole({ kind: 'team', source: 'teamId' })] },
});

export const schema = defineSchema(
   {
      /* ------------------------------ workflow ------------------------------ */

      workflowState: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().optional(),
            name: field.string(),
            color: field.string(),
            category: field.enum([
               'triage',
               'backlog',
               'unstarted',
               'started',
               'completed',
               'canceled',
            ]),
            position: field.number().default(0),
         },
         orgScoped('workflow_state')
      ),

      label: model(
         {
            workspaceId: field.string().from('organization_id'),
            name: field.string(),
            color: field.string(),
            /** A group holds labels and is never applied to an issue itself. */
            isGroup: field.boolean().from('is_group').optional(),
            parentId: field.string().from('parent_id').indexed().optional(),
         },
         orgScoped('label')
      ),

      /* ---------------------------- initiatives ----------------------------- */

      initiative: model(
         {
            workspaceId: field.string().from('organization_id'),
            name: field.string(),
            description: field.string().optional(),
            icon: field.string().optional(),
            status: field.enum(['active', 'planned', 'completed']),
            priority: field.number().default(0),
            ownerId: field.string().optional(),
            target: field.string().optional(),
            health: field.enum(['no-update', 'on-track', 'at-risk', 'off-track']),
         },
         orgScoped('initiative')
      ),

      /* ------------------------------ projects ------------------------------ */

      project: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            name: field.string(),
            summary: field.string().optional(),
            /** Block JSON, the same shape an issue description uses. */
            description: field.string().default(''),
            icon: field.string().optional(),
            statusId: field.string(),
            percentComplete: field.number().default(0),
            startDate: field.string().optional(),
            targetDate: field.string().optional(),
            leadId: field.string().optional(),
            priority: field.number().default(0),
            health: field.enum(['no-update', 'on-track', 'at-risk', 'off-track']),
            healthUpdatedAt: field.date().optional(),
            initiativeId: field.string().optional(),
         },
         {
            ...teamScoped('project'),
            relations: { initiative: relation.belongsTo('initiative', 'initiativeId') },
         }
      ),

      projectLabel: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            projectId: field.string(),
            labelId: field.string(),
         },
         {
            ...teamScoped('project_label'),
            relations: { project: relation.belongsTo('project', 'projectId', { parent: true }) },
         }
      ),

      projectMilestone: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            projectId: field.string(),
            name: field.string(),
            targetDate: field.string().optional(),
            done: field.boolean().default(false),
            position: field.number().default(0),
         },
         {
            ...teamScoped('project_milestone'),
            relations: { project: relation.belongsTo('project', 'projectId', { parent: true }) },
         }
      ),

      projectUpdate: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            projectId: field.string(),
            authorId: field.string(),
            health: field.enum(['no-update', 'on-track', 'at-risk', 'off-track']),
            body: field.string(),
         },
         {
            ...teamScoped('project_update'),
            relations: { project: relation.belongsTo('project', 'projectId', { parent: true }) },
         }
      ),

      projectResource: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            projectId: field.string(),
            title: field.string(),
            url: field.string(),
         },
         {
            ...teamScoped('project_resource'),
            relations: { project: relation.belongsTo('project', 'projectId', { parent: true }) },
         }
      ),

      /* ------------------------------- cycles ------------------------------- */

      cycle: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            number: field.number(),
            name: field.string(),
            status: field.enum(['planned', 'upcoming', 'current', 'completed']),
            startDate: field.string(),
            endDate: field.string(),
            capacity: field.number().default(100),
         },
         teamScoped('cycle')
      ),

      /* ------------------------------- issues ------------------------------- */

      issue: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            identifier: field.string().indexed(),
            title: field.string(),
            description: field.string().default(''),
            statusId: field.string().indexed(),
            assigneeId: field.string().indexed().optional(),
            priority: field.number().default(0),
            cycleId: field.string().indexed().optional(),
            projectId: field.string().indexed().optional(),
            parentIssueId: field.string().optional(),
            milestoneId: field.string().optional(),
            rank: field.string(),
            /** Label ids live on the issue; see db/schema/app.ts for why. */
            labelIds: field.json(z.array(z.string())),
            dueDate: field.string().optional(),
            completedAt: field.date().optional(),
         },
         {
            ...teamScoped('issue'),
            relations: {
               project: relation.belongsTo('project', 'projectId'),
               cycle: relation.belongsTo('cycle', 'cycleId'),
               status: relation.belongsTo('workflowState', 'statusId'),
            },
         }
      ),

      issueLink: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            issueId: field.string().indexed(),
            relatedIssueId: field.string().indexed(),
            type: field.enum(['blocks', 'related', 'duplicates']),
         },
         teamScoped('issue_link')
      ),

      issuePullRequest: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            issueId: field.string().indexed(),
            url: field.string(),
            title: field.string(),
            state: field.enum(['open', 'merged', 'closed', 'draft']).default('open'),
         },
         {
            ...teamScoped('issue_pull_request'),
            relations: { issue: relation.belongsTo('issue', 'issueId', { parent: true }) },
         }
      ),

      comment: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            issueId: field.string().indexed(),
            authorId: field.string(),
            body: field.string(),
            parentCommentId: field.string().optional(),
            reactions: field.json(),
         },
         {
            ...teamScoped('comment'),
            relations: { issue: relation.belongsTo('issue', 'issueId', { parent: true }) },
         }
      ),

      issueActivity: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            issueId: field.string().indexed(),
            actorId: field.string(),
            type: field.string(),
            payload: field.json(),
         },
         {
            ...teamScoped('issue_activity'),
            relations: { issue: relation.belongsTo('issue', 'issueId', { parent: true }) },
         }
      ),

      /* ------------------------- documents and views ------------------------ */

      documentFolder: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string(),
            name: field.string(),
            icon: field.string().optional(),
         },
         teamScoped('document_folder')
      ),

      document: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            folderId: field.string().optional(),
            title: field.string(),
            icon: field.string().optional(),
            content: field.string().default(''),
         },
         teamScoped('document')
      ),

      savedView: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().optional(),
            name: field.string(),
            icon: field.string().optional(),
            description: field.string().optional(),
            filters: field.json(),
            sharedWithTeamId: field.string().optional(),
         },
         orgScoped('saved_view')
      ),

      /* -------------------------------- inbox ------------------------------- */

      /** Only reaches its recipient: the group is the user, not the team. */
      notification: model(
         {
            workspaceId: field.string().from('organization_id'),
            userId: field.string().indexed(),
            type: field.string(),
            issueId: field.string().optional(),
            actorId: field.string().optional(),
            readAt: field.date().optional(),
            snoozedUntil: field.date().optional(),
         },
         {
            tableName: 'notification',
            policy: tenancy,
            groups: { roles: [entityRole({ kind: 'user', source: 'userId' })] },
         }
      ),

      /* --------------------------- per-person marks -------------------------- */

      /**
       * Starred things. Scoped to the person, like a notification — nobody
       * else's favourites reach your client, so the sidebar's Favorites list is
       * simply everything this model holds.
       */
      favorite: model(
         {
            workspaceId: field.string().from('organization_id'),
            userId: field.string().indexed(),
            entityType: field.enum(['issue', 'project', 'cycle', 'document', 'view', 'team']),
            entityId: field.string().indexed(),
         },
         {
            tableName: 'favorite',
            policy: tenancy,
            groups: { roles: [entityRole({ kind: 'user', source: 'userId' })] },
         }
      ),

      /**
       * Who is watching what.
       *
       * Org-scoped, unlike `favorite`: posting a comment has to notify the
       * other subscribers, and that write happens in the commenter's browser,
       * so their client must be able to see subscriptions that are not theirs.
       */
      subscription: model(
         {
            workspaceId: field.string().from('organization_id'),
            userId: field.string().indexed(),
            entityType: field.enum(['issue', 'team', 'project']),
            entityId: field.string().indexed(),
         },
         orgScoped('subscription')
      ),

      /* ------------------------------- agents ------------------------------- */

      agentRun: model(
         {
            workspaceId: field.string().from('organization_id'),
            agentUserId: field.string(),
            requestedById: field.string(),
            issueId: field.string().indexed().optional(),
            teamId: field.string().indexed(),
            status: field.enum(['queued', 'running', 'waiting', 'succeeded', 'failed', 'canceled']),
            sessionId: field.string().optional(),
            prompt: field.string(),
            currentStep: field.string().optional(),
            result: field.string().optional(),
            error: field.string().optional(),
            startedAt: field.date().optional(),
            finishedAt: field.date().optional(),
         },
         teamScoped('agent_run')
      ),

      /**
       * Durable agent↔human messages. Claim descriptions are ephemeral, so
       * anything that must survive a reconnect is a row (see Ablo's
       * agent-messaging guide).
       */
      agentMessage: model(
         {
            workspaceId: field.string().from('organization_id'),
            teamId: field.string().indexed(),
            runId: field.string().optional(),
            authorId: field.string(),
            kind: field.enum(['status', 'request', 'handoff', 'result']),
            body: field.string(),
            aboutEntityType: field.string().optional(),
            aboutEntityId: field.string().optional(),
            aboutClaimId: field.string().optional(),
         },
         teamScoped('agent_message')
      ),
   },
   {
      /**
       * Where a participant's groups come from. `organizationId` and `teamIds`
       * are handed over by the session route from the Better Auth session; a
       * human never picks their own scope.
       */
      identityRoles: [
         identityRole({ kind: 'org', source: 'workspaceId' }),
         identityRole({ kind: 'user', source: 'userId' }),
         identityRole({ kind: 'team', source: 'teamIds', multi: true }),
      ],
   }
);
