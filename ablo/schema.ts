/**
 * Circle work records use organization, team or user subjects for scoped access.
 * Better Auth owns identity tables; /api/ablo-session derives grants from membership.
 */
import { defineSchema, field, identityRole, model, relation, z } from '@abloatai/ablo/schema';

/**
 * Ablo's tenant column is separate from Circle's organization_id. Subjects below
 * constrain individual actors within that tenant; the secret issuer key remains
 * privileged and must never reach the browser. Negative-access tests must pass
 * before treating this adapted fixture as a verified authorization boundary.
 */
const tenancy = { by: 'column', column: 'ablo_tenant_id' } as const;

const orgScoped = (tableName: string) => ({
   tableName,
   policy: tenancy,
   subject: { field: 'workspaceId', group: 'org' },
});

const teamScoped = (tableName: string) => ({
   tableName,
   policy: tenancy,
   subject: { field: 'teamId', group: 'team' },
});

export const schema = defineSchema(
   {
      /* ------------------------------ workflow ------------------------------ */

      workflowState: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
            issueId: field.string().indexed(),
            relatedIssueId: field.string().indexed(),
            type: field.enum(['blocks', 'related', 'duplicates']),
         },
         teamScoped('issue_link')
      ),

      issuePullRequest: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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

      /* ----------------------- cross-model code review ---------------------- */

      reviewMission: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
            issueId: field.string().indexed(),
            repositoryId: field.string(),
            pullRequestUrl: field.string().indexed(),
            repository: field.string(),
            pullNumber: field.number(),
            headSha: field.string().indexed(),
            requestedById: field.string(),
            agentRunId: field.string().indexed().optional(),
            status: field.enum(['queued', 'running', 'waiting', 'succeeded', 'failed', 'canceled']),
            phase: field.enum(['queued', 'independent', 'cross_review', 'synthesis', 'completed']),
            verdict: field.enum(['approve', 'request_changes', 'comment']).optional(),
            summary: field.string().optional(),
            confidence: field.number().optional(),
            completedAt: field.date().optional(),
         },
         teamScoped('review_mission')
      ),

      reviewAnalysis: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
            missionId: field.string().indexed(),
            model: field.enum(['gpt', 'claude', 'scout']),
            phase: field.enum(['independent', 'cross_review', 'synthesis']),
            status: field.enum(['queued', 'running', 'succeeded', 'failed']),
            summary: field.string().optional(),
            recommendation: field.enum(['approve', 'request_changes', 'comment']).optional(),
            confidence: field.number().optional(),
            result: field.json().optional(),
            startedAt: field.date().optional(),
            finishedAt: field.date().optional(),
         },
         {
            ...teamScoped('review_analysis'),
            relations: {
               mission: relation.belongsTo('reviewMission', 'missionId', { parent: true }),
            },
         }
      ),

      reviewFinding: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
            missionId: field.string().indexed(),
            category: field.enum([
               'correctness',
               'security',
               'tests',
               'performance',
               'maintainability',
            ]),
            severity: field.enum(['blocker', 'high', 'medium', 'low']),
            title: field.string(),
            body: field.string(),
            evidence: field.string(),
            path: field.string().optional(),
            line: field.number().optional(),
            raisedBy: field.json(),
            challengedBy: field.json(),
            resolution: field.enum(['confirmed', 'disputed', 'dismissed']),
            confidence: field.number(),
            fingerprint: field.string(),
         },
         {
            ...teamScoped('review_finding'),
            relations: {
               mission: relation.belongsTo('reviewMission', 'missionId', { parent: true }),
            },
         }
      ),

      comment: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().min(1),
            name: field.string(),
            icon: field.string().optional(),
         },
         teamScoped('document_folder')
      ),

      document: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
            folderId: field.string().optional(),
            title: field.string(),
            icon: field.string().optional(),
            content: field.string().default(''),
         },
         teamScoped('document')
      ),

      savedView: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            userId: field.string().indexed().min(1),
            type: field.string(),
            issueId: field.string().optional(),
            actorId: field.string().optional(),
            readAt: field.date().optional(),
            snoozedUntil: field.date().optional(),
         },
         {
            tableName: 'notification',
            policy: tenancy,
            subject: { field: 'userId', group: 'user' },
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
            workspaceId: field.string().from('organization_id').min(1),
            userId: field.string().indexed().min(1),
            entityType: field.enum(['issue', 'project', 'cycle', 'document', 'view', 'team']),
            entityId: field.string().indexed(),
         },
         {
            tableName: 'favorite',
            policy: tenancy,
            subject: { field: 'userId', group: 'user' },
         }
      ),

      /**
       * Who is watching what.
       *
       * Org-scoped, unlike `favorite`. Notification delivery resolves these
       * watchers on the server and checks current team access before writing.
       */
      subscription: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            userId: field.string().indexed().min(1),
            entityType: field.enum(['issue', 'team', 'project']),
            entityId: field.string().indexed(),
         },
         orgScoped('subscription')
      ),

      /* ------------------------------- agents ------------------------------- */

      agentRun: model(
         {
            workspaceId: field.string().from('organization_id').min(1),
            agentUserId: field.string(),
            requestedById: field.string(),
            issueId: field.string().indexed().optional(),
            teamId: field.string().indexed().min(1),
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
            workspaceId: field.string().from('organization_id').min(1),
            teamId: field.string().indexed().min(1),
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
