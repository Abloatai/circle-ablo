import 'server-only';

import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { format, formatDistanceToNow } from 'date-fns';
import { sync } from '@/ablo';
import { db } from '@/db';
import * as t from '@/db/schema';
import { dispatchIssueAgent } from '@/lib/agent-dispatch';
import { findWorkspaceAgent } from '@/lib/agent-runtime';
import {
   createReviewId,
   parseGitHubPatch,
   parseReviewId,
   type Review,
   type ReviewCollection,
   type ReviewEvent,
   type ReviewStatus,
   type ReviewSummary,
   type SubmittedReview,
} from '@/lib/domain/reviews';
import type { Viewer } from '@/lib/session';
import { githubInstallationRequest, inspectPullRequest } from './app';

interface ConnectedRepository {
   id: string;
   installationId: number;
   teamId: string;
   owner: string;
   name: string;
   fullName: string;
   htmlUrl: string;
}

interface PullListItem {
   number: number;
   title: string;
   url: string;
   state: string;
   draft: boolean;
   mergedAt: string | null;
   author: string;
   baseRefName: string;
   headRefName: string;
   updatedAt: string;
}

interface PullRequestGraphNode {
   number: number;
   title: string;
   url: string;
   state: 'OPEN' | 'CLOSED' | 'MERGED';
   isDraft: boolean;
   mergedAt: string | null;
   author: { login: string } | null;
   baseRefName: string;
   headRefName: string;
   updatedAt: string;
}

interface PullRequestGraphResponse {
   data?: Record<string, { pullRequests: { nodes: PullRequestGraphNode[] } } | null | undefined>;
   errors?: Array<{ message: string }>;
}

function reviewStatus(pull: Pick<PullListItem, 'draft' | 'mergedAt' | 'state'>): ReviewStatus {
   if (pull.mergedAt || pull.state === 'merged') return 'merged';
   if (pull.draft) return 'draft';
   return pull.state === 'closed' ? 'closed' : 'open';
}

async function connectedRepositories(viewer: Viewer): Promise<ConnectedRepository[]> {
   if (viewer.teamIds.length === 0) return [];

   return db
      .select({
         id: t.githubRepository.id,
         installationId: t.githubInstallation.installationId,
         teamId: t.githubRepository.teamId,
         owner: t.githubRepository.owner,
         name: t.githubRepository.name,
         fullName: t.githubRepository.fullName,
         htmlUrl: t.githubRepository.htmlUrl,
      })
      .from(t.githubRepository)
      .innerJoin(
         t.githubInstallation,
         eq(t.githubInstallation.id, t.githubRepository.installationId)
      )
      .where(
         and(
            eq(t.githubInstallation.organizationId, viewer.organizationId),
            isNull(t.githubInstallation.suspendedAt),
            eq(t.githubRepository.enabled, true),
            inArray(t.githubRepository.teamId, viewer.teamIds)
         )
      ) as Promise<ConnectedRepository[]>;
}

function summary(repository: ConnectedRepository, pull: PullListItem): ReviewSummary {
   return {
      id: createReviewId(repository.id, pull.number),
      title: pull.title,
      status: reviewStatus(pull),
      repository: repository.fullName,
      prNumber: pull.number,
      url: pull.url,
      author: pull.author,
      targetBranch: pull.baseRefName,
      sourceBranch: pull.headRefName,
      updatedAt: pull.updatedAt,
      updatedLabel: formatDistanceToNow(new Date(pull.updatedAt), { addSuffix: true }),
   };
}

const GRAPHQL_BATCH_SIZE = 20;

function chunks<T>(values: T[], size: number): T[][] {
   const result: T[][] = [];
   for (let index = 0; index < values.length; index += size) {
      result.push(values.slice(index, index + size));
   }
   return result;
}

async function listRepositoryBatch(
   repositories: ConnectedRepository[],
   state: 'open' | 'completed' | 'all'
): Promise<{ reviews: ReviewSummary[]; failedRepositories: number; errors: string[] }> {
   const variables: Record<string, string> = {};
   const definitions: string[] = [];
   const selections: string[] = [];
   const stateArgument =
      state === 'open'
         ? 'states: [OPEN], '
         : state === 'completed'
           ? 'states: [CLOSED, MERGED], '
           : '';

   repositories.forEach((repository, index) => {
      definitions.push(`$owner${index}: String!`, `$name${index}: String!`);
      variables[`owner${index}`] = repository.owner;
      variables[`name${index}`] = repository.name;
      selections.push(`
         r${index}: repository(owner: $owner${index}, name: $name${index}) {
            pullRequests(first: 20, ${stateArgument}orderBy: { field: UPDATED_AT, direction: DESC }) {
               nodes {
                  number
                  title
                  url
                  state
                  isDraft
                  mergedAt
                  author { login }
                  baseRefName
                  headRefName
                  updatedAt
               }
            }
         }
      `);
   });

   const response = await githubInstallationRequest<PullRequestGraphResponse>(
      repositories[0].installationId,
      '/graphql',
      {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            query: `query Reviews(${definitions.join(', ')}) {${selections.join('\n')}}`,
            variables,
         }),
      }
   );

   const reviews: ReviewSummary[] = [];
   let failedRepositories = 0;
   repositories.forEach((repository, index) => {
      const result = response.data?.[`r${index}`];
      if (!result) {
         failedRepositories += 1;
         return;
      }
      for (const pull of result.pullRequests.nodes) {
         reviews.push(
            summary(repository, {
               number: pull.number,
               title: pull.title,
               url: pull.url,
               state: pull.state.toLowerCase(),
               draft: pull.isDraft,
               mergedAt: pull.mergedAt,
               author: pull.author?.login ?? 'ghost',
               baseRefName: pull.baseRefName,
               headRefName: pull.headRefName,
               updatedAt: pull.updatedAt,
            })
         );
      }
   });

   return {
      reviews,
      failedRepositories,
      errors: response.errors?.map((error) => error.message) ?? [],
   };
}

export async function listCodeReviews(
   viewer: Viewer,
   state: 'open' | 'completed' | 'all'
): Promise<ReviewCollection> {
   const repositories = await connectedRepositories(viewer);
   const byInstallation = new Map<number, ConnectedRepository[]>();
   for (const repository of repositories) {
      const group = byInstallation.get(repository.installationId) ?? [];
      group.push(repository);
      byInstallation.set(repository.installationId, group);
   }
   const batches = [...byInstallation.values()].flatMap((group) =>
      chunks(group, GRAPHQL_BATCH_SIZE)
   );
   const results = await Promise.allSettled(
      batches.map((batch) => listRepositoryBatch(batch, state))
   );

   const reviews = results
      .flatMap((result) => (result.status === 'fulfilled' ? result.value.reviews : []))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 200);
   const failedRepositories = results.reduce((count, result, index) => {
      return (
         count +
         (result.status === 'fulfilled'
            ? result.value.failedRepositories
            : (batches[index]?.length ?? 0))
      );
   }, 0);
   const errors = results.flatMap((result) =>
      result.status === 'fulfilled'
         ? result.value.errors
         : [result.reason instanceof Error ? result.reason.message : String(result.reason)]
   );
   if (errors.length > 0) {
      console.error('[github] pull-request listing was incomplete', {
         failedRepositories,
         errors: [...new Set(errors)].slice(0, 5),
      });
   }

   return { reviews, connectedRepositories: repositories.length, failedRepositories };
}

async function reviewRepository(
   viewer: Viewer,
   reviewId: string
): Promise<{
   repository: ConnectedRepository;
   pullNumber: number;
} | null> {
   const parsed = parseReviewId(reviewId);
   if (!parsed || viewer.teamIds.length === 0) return null;
   const [repository] = await db
      .select({
         id: t.githubRepository.id,
         installationId: t.githubInstallation.installationId,
         teamId: t.githubRepository.teamId,
         owner: t.githubRepository.owner,
         name: t.githubRepository.name,
         fullName: t.githubRepository.fullName,
         htmlUrl: t.githubRepository.htmlUrl,
      })
      .from(t.githubRepository)
      .innerJoin(
         t.githubInstallation,
         eq(t.githubInstallation.id, t.githubRepository.installationId)
      )
      .where(
         and(
            eq(t.githubRepository.id, parsed.repositoryId),
            eq(t.githubInstallation.organizationId, viewer.organizationId),
            isNull(t.githubInstallation.suspendedAt),
            eq(t.githubRepository.enabled, true),
            inArray(t.githubRepository.teamId, viewer.teamIds)
         )
      )
      .limit(1);
   return repository
      ? { repository: repository as ConnectedRepository, pullNumber: parsed.pullNumber }
      : null;
}

export async function getCodeReview(viewer: Viewer, reviewId: string): Promise<Review | null> {
   const resolved = await reviewRepository(viewer, reviewId);
   if (!resolved) return null;
   const { repository, pullNumber } = resolved;
   const url = `${repository.htmlUrl}/pull/${pullNumber}`;
   const pullPath = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullNumber}`;

   const [pull, submittedReviews, linkedIssue] = await Promise.all([
      inspectPullRequest({
         organizationId: viewer.organizationId,
         teamId: repository.teamId,
         url,
      }),
      githubInstallationRequest<
         Array<{
            id: number;
            user: { login: string } | null;
            state: string;
            body: string | null;
            submitted_at: string | null;
         }>
      >(repository.installationId, `${pullPath}/reviews?per_page=100`),
      db
         .select({
            id: t.issue.id,
            identifier: t.issue.identifier,
            title: t.issue.title,
         })
         .from(t.issuePullRequest)
         .innerJoin(t.issue, eq(t.issue.id, t.issuePullRequest.issueId))
         .where(
            and(
               eq(t.issuePullRequest.organizationId, viewer.organizationId),
               eq(t.issuePullRequest.teamId, repository.teamId),
               eq(t.issuePullRequest.url, url)
            )
         )
         .orderBy(desc(t.issuePullRequest.createdAt))
         .limit(1),
   ]);

   const files = pull.files.map((file) => {
      const diff = parseGitHubPatch(file);
      return {
         filename: file.filename,
         name: diff.name,
         path: diff.path,
         status: file.status,
         additions: file.additions,
         deletions: file.deletions,
         category: /(^|\/)(__tests__|test|tests|specs?)(\/|\.)|\.(test|spec)\./i.test(file.filename)
            ? ('tests' as const)
            : ('implementation' as const),
         diff,
      };
   });

   return {
      id: reviewId,
      title: pull.title,
      status: pull.state,
      repository: pull.repository,
      prNumber: pull.number,
      url: pull.url,
      author: pull.author,
      targetBranch: pull.baseBranch,
      sourceBranch: pull.headBranch,
      updatedAt: pull.updatedAt,
      updatedLabel: formatDistanceToNow(new Date(pull.updatedAt), { addSuffix: true }),
      body: pull.body,
      headSha: pull.headSha,
      additions: pull.additions,
      deletions: pull.deletions,
      changedFiles: pull.changedFiles,
      commits: pull.commits,
      files,
      submittedReviews: submittedReviews.map(
         (review): SubmittedReview => ({
            id: review.id,
            author: review.user?.login ?? 'ghost',
            state: review.state,
            body: review.body ?? '',
            submittedAt: review.submitted_at,
            submittedLabel: review.submitted_at
               ? format(new Date(review.submitted_at), 'MMM d, yyyy')
               : null,
         })
      ),
      linkedIssue: linkedIssue[0],
      truncated: pull.truncated,
   };
}

export async function submitCodeReview(input: {
   viewer: Viewer;
   reviewId: string;
   event: ReviewEvent;
   body: string;
}): Promise<void> {
   const resolved = await reviewRepository(input.viewer, input.reviewId);
   if (!resolved) throw new Error('Pull request not found');
   const body = input.body.trim();
   if (body.length > 10_000) throw new Error('Review comments must be 10,000 characters or fewer');
   if (input.event !== 'APPROVE' && !body) {
      throw new Error('Add a review comment before submitting');
   }

   const { repository, pullNumber } = resolved;
   await githubInstallationRequest(
      repository.installationId,
      `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls/${pullNumber}/reviews`,
      {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ event: input.event, ...(body ? { body } : {}) }),
      }
   );
}

async function nextIssueNumber(teamId: string, organizationId: string): Promise<number> {
   const [claimed] = await db
      .insert(t.issueCounter)
      .values({ teamId, organizationId, next: 2 })
      .onConflictDoUpdate({
         target: t.issueCounter.teamId,
         set: { next: sql`${t.issueCounter.next} + 1` },
      })
      .returning({ next: t.issueCounter.next });
   return claimed.next - 1;
}

/** Creates a durable GPT + Claude review mission and lets Scout orchestrate it. */
export async function deployReviewTeamToCodeReview(input: {
   viewer: Viewer;
   reviewId: string;
}): Promise<{
   issueId: string;
   identifier: string;
   runId: string;
   createdIssue: boolean;
   alreadyRunning: boolean;
   missionId: string;
}> {
   const resolved = await reviewRepository(input.viewer, input.reviewId);
   if (!resolved) throw new Error('Pull request not found');
   const { repository, pullNumber } = resolved;
   const url = `${repository.htmlUrl}/pull/${pullNumber}`;

   const [pull, existingIssues, agentUserId] = await Promise.all([
      inspectPullRequest({
         organizationId: input.viewer.organizationId,
         teamId: repository.teamId,
         url,
      }),
      db
         .select({
            id: t.issue.id,
            identifier: t.issue.identifier,
         })
         .from(t.issuePullRequest)
         .innerJoin(t.issue, eq(t.issue.id, t.issuePullRequest.issueId))
         .where(
            and(
               eq(t.issuePullRequest.organizationId, input.viewer.organizationId),
               eq(t.issuePullRequest.teamId, repository.teamId),
               eq(t.issuePullRequest.url, url)
            )
         )
         .orderBy(desc(t.issuePullRequest.createdAt))
         .limit(1),
      findWorkspaceAgent(input.viewer.organizationId, repository.teamId),
   ]);
   if (!agentUserId) throw new Error('This team does not have a Scout agent');

   const [activeStatus] = await db
      .select({
         id: t.workflowState.id,
         name: t.workflowState.name,
         position: t.workflowState.position,
      })
      .from(t.workflowState)
      .where(
         and(
            eq(t.workflowState.organizationId, input.viewer.organizationId),
            or(isNull(t.workflowState.teamId), eq(t.workflowState.teamId, repository.teamId)),
            eq(t.workflowState.category, 'started')
         )
      )
      .orderBy(
         sql`case when lower(${t.workflowState.name}) = 'technical review' then 0 else 1 end`,
         t.workflowState.position
      )
      .limit(1);

   await sync.ready();
   let issue = existingIssues[0];
   let createdIssue = false;

   if (!issue) {
      const [team, statuses] = await Promise.all([
         db
            .select({ key: t.team.key, name: t.team.name, archivedAt: t.team.archivedAt })
            .from(t.team)
            .where(
               and(
                  eq(t.team.id, repository.teamId),
                  eq(t.team.organizationId, input.viewer.organizationId)
               )
            )
            .limit(1),
         db
            .select({
               id: t.workflowState.id,
               category: t.workflowState.category,
               position: t.workflowState.position,
            })
            .from(t.workflowState)
            .where(
               and(
                  eq(t.workflowState.organizationId, input.viewer.organizationId),
                  or(isNull(t.workflowState.teamId), eq(t.workflowState.teamId, repository.teamId))
               )
            )
            .orderBy(
               sql`case ${t.workflowState.category}
                  when 'unstarted' then 0
                  when 'backlog' then 1
                  when 'triage' then 2
                  when 'started' then 3
                  else 4
               end`,
               t.workflowState.position
            ),
      ]);
      if (!team[0]) throw new Error('The repository team no longer exists');
      if (team[0].archivedAt) {
         throw new Error(`${team[0].name} is retired, so it cannot take a review issue`);
      }
      const status = statuses.find(
         (candidate) => candidate.category !== 'completed' && candidate.category !== 'canceled'
      );
      if (!status) throw new Error('This team does not have an active issue status');

      const number = await nextIssueNumber(repository.teamId, input.viewer.organizationId);
      const created = await sync.issue.create({
         data: {
            workspaceId: input.viewer.organizationId,
            teamId: repository.teamId,
            identifier: `${team[0].key}-${number}`,
            title: `Review ${pull.repository}#${pull.number}: ${pull.title}`,
            description: JSON.stringify([
               {
                  type: 'paragraph',
                  text: `Cross-review ${pull.url} with GPT and Claude. Reconcile their findings into one actionable verdict.`,
               },
            ]),
            statusId: status.id,
            assigneeId: agentUserId,
            priority: 0,
            labelIds: [],
            rank: `z${Date.now().toString(36)}`,
         },
      });
      issue = { id: created.id, identifier: `${team[0].key}-${number}` };
      createdIssue = true;

      await sync.issuePullRequest.create({
         data: {
            id: crypto.randomUUID(),
            workspaceId: input.viewer.organizationId,
            teamId: repository.teamId,
            issueId: issue.id,
            url: pull.url,
            title: `${pull.repository}#${pull.number}`,
            state: pull.state,
         },
      });
   } else {
      await sync.issue.update({ id: issue.id, data: { assigneeId: agentUserId } });
   }

   const [activeMission] = await db
      .select({ id: t.reviewMission.id, runId: t.reviewMission.agentRunId })
      .from(t.reviewMission)
      .where(
         and(
            eq(t.reviewMission.organizationId, input.viewer.organizationId),
            eq(t.reviewMission.teamId, repository.teamId),
            eq(t.reviewMission.pullRequestUrl, pull.url),
            eq(t.reviewMission.headSha, pull.headSha),
            inArray(t.reviewMission.status, ['queued', 'running', 'waiting'])
         )
      )
      .orderBy(desc(t.reviewMission.createdAt))
      .limit(1);
   if (activeMission?.runId) {
      return {
         issueId: issue.id,
         identifier: issue.identifier,
         runId: activeMission.runId,
         createdIssue,
         alreadyRunning: true,
         missionId: activeMission.id,
      };
   }

   const mission = await sync.reviewMission.create({
      data: {
         workspaceId: input.viewer.organizationId,
         teamId: repository.teamId,
         issueId: issue.id,
         repositoryId: repository.id,
         pullRequestUrl: pull.url,
         repository: pull.repository,
         pullNumber: pull.number,
         headSha: pull.headSha,
         requestedById: input.viewer.id,
         status: 'queued',
         phase: 'queued',
      },
   });

   await Promise.all(
      [
         ['gpt', 'independent'],
         ['claude', 'independent'],
         ['gpt', 'cross_review'],
         ['claude', 'cross_review'],
         ['scout', 'synthesis'],
      ].map(([model, phase]) =>
         sync.reviewAnalysis.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: input.viewer.organizationId,
               teamId: repository.teamId,
               missionId: mission.id,
               model: model as 'gpt' | 'claude' | 'scout',
               phase: phase as 'independent' | 'cross_review' | 'synthesis',
               status: 'queued',
            },
         })
      )
   );

   const request = [
      '[CIRCLE_REVIEW_TEAM]',
      `missionId: ${mission.id}`,
      `Review pull request ${pull.url} at head SHA ${pull.headSha}.`,
      'Run GPT and Claude independently, then have each critique the other model’s findings.',
      'Reconcile only evidence-backed findings into one verdict and publish it through the review-team tools.',
      'This is review-only: do not merge or modify the pull request.',
   ].join('\n');

   let run: Awaited<ReturnType<typeof dispatchIssueAgent>>;
   try {
      run = await dispatchIssueAgent({
         viewer: input.viewer,
         issueId: issue.id,
         agentUserId,
         prompt: request,
      });
      await sync.reviewMission.update({
         id: mission.id,
         data: { status: 'running', phase: 'independent', agentRunId: run.runId },
      });

      // The review happens in a separate runtime and can take several minutes.
      // Make the handoff visible on the issue immediately instead of leaving a
      // freshly assigned Scout issue sitting silently in Todo.
      const startedComment = [
         'Cross-model review started',
         '',
         `GPT and Claude are reviewing ${pull.repository}#${pull.number} independently at ${pull.headSha.slice(0, 12)}. They will challenge each other’s findings before Scout publishes the final verdict.`,
      ].join('\n');
      const feedbackWrites: Promise<unknown>[] = [
         sync.comment.create({
            data: {
               id: `review_started_${mission.id}`,
               workspaceId: input.viewer.organizationId,
               teamId: repository.teamId,
               issueId: issue.id,
               authorId: agentUserId,
               body: JSON.stringify(
                  startedComment.split(/\n{2,}/).map((text) => ({ type: 'paragraph', text }))
               ),
               reactions: {},
            },
         }),
         sync.notification.create({
            data: {
               id: `review_started_${mission.id}`,
               workspaceId: input.viewer.organizationId,
               userId: input.viewer.id,
               type: 'comment',
               issueId: issue.id,
               actorId: agentUserId,
            },
         }),
      ];
      if (activeStatus) {
         feedbackWrites.push(
            sync.issue.update({ id: issue.id, data: { statusId: activeStatus.id } })
         );
      }
      const feedbackResults = await Promise.allSettled(feedbackWrites);
      const feedbackErrors = feedbackResults.flatMap((result) =>
         result.status === 'rejected'
            ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
            : []
      );
      if (feedbackErrors.length > 0) {
         console.error('[review-team] mission started but issue feedback was incomplete', {
            missionId: mission.id,
            errors: feedbackErrors,
         });
      }
   } catch (error) {
      await sync.reviewMission.update({
         id: mission.id,
         data: { status: 'failed' },
      });
      throw error;
   }
   return {
      issueId: issue.id,
      identifier: issue.identifier,
      runId: run.runId,
      createdIssue,
      alreadyRunning: false,
      missionId: mission.id,
   };
}
