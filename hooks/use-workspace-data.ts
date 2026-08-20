'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { useMemo } from 'react';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';
import {
   hydrateInitiative,
   hydrateIssue,
   hydrateProject,
   hydrateStatus,
   type HydrateContext,
   type HydratedIssue,
} from '@/lib/data/hydrate';
import { projectIcon } from '@/lib/data/icon-registry';
import type { Member } from '@/lib/data/members';
import type { ActivityItem, ContentBlock } from '@/lib/domain/issue-details';
import type { ProjectUpdateHealth } from '@/lib/domain/project-details';
import type { Initiative } from '@/lib/domain/initiatives';
import type { LabelInterface } from '@/lib/domain/labels';
import type { Project } from '@/lib/domain/projects';
import type { Status } from '@/lib/domain/status';
import type { Team } from '@/lib/domain/teams';
import type { View, ViewFilter, ViewType } from '@/lib/domain/views';
import type { Cycle } from '@/lib/domain/cycles';

/**
 * Live workspace data, in the shapes the existing views expect.
 *
 * Every read here is a synchronous local read off the synced pool, so it stays
 * reactive in render: when anyone — a teammate or an agent — commits a change,
 * the row arrives over the stream and these recompute.
 */
export function useStatuses(): Status[] {
   const rows =
      useAblo((ablo) => ablo.workflowState.local.list({ orderBy: { position: 'asc' } })) ?? [];
   return useMemo(() => rows.map(hydrateStatus), [rows]);
}

export function useLabels(): LabelInterface[] {
   const rows = useAblo((ablo) => ablo.label.local.list({})) ?? [];
   return useMemo(
      () => rows.map((row) => ({ id: row.id, name: row.name, color: row.color })),
      [rows]
   );
}

export function useProjects(): Project[] {
   const rows = useAblo((ablo) => ablo.project.local.list({})) ?? [];
   const statuses = useStatuses();
   const { membersById } = useWorkspace();

   return useMemo(() => {
      const statusesById = new Map(statuses.map((s) => [s.id, s]));
      return rows.map((row) =>
         hydrateProject(row, statusesById, membersById, projectIcon(row.icon))
      );
   }, [rows, statuses, membersById]);
}

/**
 * Workspace initiatives, live.
 *
 * The edge to projects lives on the project (`initiativeId`), so the projects
 * are read here too and the initiative's `projectIds` derived from them — which
 * also means moving a project into an initiative updates both views at once.
 */
export function useInitiatives(): Initiative[] {
   const rows = useAblo((ablo) => ablo.initiative.local.list({})) ?? [];
   const projects = useProjects();
   const { membersById } = useWorkspace();

   return useMemo(
      () => rows.map((row) => hydrateInitiative(row, membersById, projects)),
      [rows, membersById, projects]
   );
}

/* -------------------------------------------------------------------------- */
/*                       A project's milestones and links                     */
/* -------------------------------------------------------------------------- */

export interface MilestoneItem {
   id: string;
   name: string;
   targetDate?: string;
   completed: boolean;
   position: number;
}

export interface ResourceItem {
   id: string;
   label: string;
   url: string;
}

/** A project's milestones, in the order they were put in. */
export function useProjectMilestones(projectId: string): MilestoneItem[] {
   const rows = useAblo((ablo) => ablo.projectMilestone.local.list({})) ?? [];

   return useMemo(
      () =>
         rows
            .filter((row) => row.projectId === projectId)
            .map((row) => ({
               id: row.id,
               name: row.name,
               targetDate: row.targetDate ?? undefined,
               // The column is `done`; every view here calls it `completed`.
               completed: Boolean(row.done),
               position: row.position ?? 0,
            }))
            .sort((a, b) => a.position - b.position),
      [rows, projectId]
   );
}

/** A project's linked resources — specs, designs, dashboards. */
export function useProjectResources(projectId: string): ResourceItem[] {
   const rows = useAblo((ablo) => ablo.projectResource.local.list({})) ?? [];

   return useMemo(
      () =>
         rows
            .filter((row) => row.projectId === projectId)
            .map((row) => ({ id: row.id, label: row.title, url: row.url })),
      [rows, projectId]
   );
}

/* -------------------------------------------------------------------------- */
/*                             Agent conversations                            */
/* -------------------------------------------------------------------------- */

export interface AgentChatMessage {
   id: string;
   role: 'user' | 'agent';
   author: Member;
   kind: 'status' | 'request' | 'handoff' | 'result';
   body: string;
   at: number;
}

export interface AgentChatItem {
   id: string;
   title: string;
   status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'canceled';
   currentStep?: string;
   error?: string;
   /** Set when the run is about an issue rather than a conversation. */
   issueId?: string;
   startedAt: number;
   messages: AgentChatMessage[];
}

/**
 * The viewer's conversations with agents, newest first.
 *
 * A chat is an `agentRun` with no issue attached, and its turns are the
 * `agentMessage` rows that name it — both live, so a reply appears as the agent
 * writes it and a teammate watching the same chat sees it too.
 */
export function useAgentChats(): AgentChatItem[] {
   const runRows = useAblo((ablo) => ablo.agentRun.local.list({})) ?? [];
   const messageRows = useAblo((ablo) => ablo.agentMessage.local.list({})) ?? [];
   const { membersById } = useWorkspace();

   return useMemo(() => {
      const at = (row: unknown, key: 'createdAt' | 'startedAt') =>
         new Date(
            ((row as Record<string, unknown>)[key] as string | Date | undefined) ?? Date.now()
         ).getTime();

      const byRun = new Map<string, AgentChatMessage[]>();
      for (const row of messageRows) {
         if (!row.runId) continue;
         const author = membersById.get(row.authorId) ?? unknownMember(row.authorId);
         const list = byRun.get(row.runId) ?? [];
         list.push({
            id: row.id,
            role: author.type === 'agent' ? 'agent' : 'user',
            author,
            kind: row.kind as AgentChatMessage['kind'],
            body: row.body,
            at: at(row, 'createdAt'),
         });
         byRun.set(row.runId, list);
      }

      return runRows
         .filter((row) => !row.issueId)
         .map((row) => {
            const messages = (byRun.get(row.id) ?? []).sort((a, b) => a.at - b.at);
            return {
               id: row.id,
               // The first thing asked names the conversation, the way it does
               // in every chat product.
               title: (messages.find((m) => m.role === 'user')?.body ?? row.prompt)
                  .split('\n')[0]
                  .slice(0, 60),
               status: row.status as AgentChatItem['status'],
               currentStep: row.currentStep ?? undefined,
               error: row.error ?? undefined,
               issueId: row.issueId ?? undefined,
               startedAt: at(row, 'startedAt'),
               messages,
            };
         })
         .sort((a, b) => b.startedAt - a.startedAt);
   }, [runRows, messageRows, membersById]);
}

/* -------------------------------------------------------------------------- */
/*                               Saved views                                  */
/* -------------------------------------------------------------------------- */

/**
 * Saved views, live.
 *
 * `filters` is a json column, so the view's type travels inside it rather than
 * in a column of its own: `{ type, filter }`. A row written before that shape
 * existed, or by hand, still renders — an unreadable blob falls back to an
 * issue view with no filter, which shows everything rather than nothing.
 */
export function useSavedViews(): View[] {
   const rows = useAblo((ablo) => ablo.savedView.local.list({})) ?? [];
   const { membersById } = useWorkspace();

   return useMemo(
      () =>
         rows.map((row) => {
            const stored = parseViewFilters(row.filters);
            const audit = (key: 'createdAt' | 'updatedAt') =>
               new Date(
                  ((row as Record<string, unknown>)[key] as string | Date | undefined) ?? Date.now()
               )
                  .toISOString()
                  .slice(0, 10);
            return {
               id: row.id,
               name: row.name,
               description: row.description ?? '',
               icon: row.icon || '🔍',
               type: stored.type,
               teamId: row.teamId ?? undefined,
               owner:
                  membersById.get((row as { createdBy?: string | null }).createdBy ?? '') ??
                  unknownMember((row as { createdBy?: string | null }).createdBy ?? 'unknown'),
               createdAt: audit('createdAt'),
               updatedAt: audit('updatedAt'),
               filter: stored.filter,
            } satisfies View;
         }),
      [rows, membersById]
   );
}

/** `{ type, filter }`, however the json arrived — parsed, raw, or malformed. */
export function parseViewFilters(value: unknown): { type: ViewType; filter: ViewFilter } {
   const raw = typeof value === 'string' ? safeParse(value) : value;
   const record = (raw ?? {}) as { type?: unknown; filter?: unknown };
   return {
      type: record.type === 'project' ? 'project' : 'issue',
      filter: (record.filter ?? {}) as ViewFilter,
   };
}

function safeParse(value: string): unknown {
   try {
      return JSON.parse(value);
   } catch {
      return {};
   }
}

/* -------------------------------------------------------------------------- */
/*                              Documents                                     */
/* -------------------------------------------------------------------------- */

export interface DocumentItem {
   id: string;
   title: string;
   icon: string;
   folderId: string | null;
   content: string;
   creator: Member;
   createdAt: string;
   updatedAt: string;
}

export interface DocumentFolderItem {
   id: string;
   name: string;
   icon: string;
   documents: DocumentItem[];
}

/**
 * A team's documents, grouped into their folders.
 *
 * Documents with no folder are grouped under a synthetic "Team documents"
 * entry with an empty id — it is a rendering group, not a row, so nothing ever
 * tries to write to it.
 */
export const UNFILED_FOLDER_ID = '';

export function useTeamDocuments(teamId: string): DocumentFolderItem[] {
   const documentRows = useAblo((ablo) => ablo.document.local.list({})) ?? [];
   const folderRows = useAblo((ablo) => ablo.documentFolder.local.list({})) ?? [];
   const { membersById } = useWorkspace();

   return useMemo(() => {
      const audit = (row: unknown, key: 'createdAt' | 'updatedAt') =>
         new Date((row as Record<string, string | Date | undefined>)[key] ?? Date.now())
            .toISOString()
            .slice(0, 10);

      const documents: DocumentItem[] = documentRows
         .filter((row) => row.teamId === teamId)
         .map((row) => ({
            id: row.id,
            title: row.title,
            icon: row.icon || '📄',
            folderId: row.folderId ?? null,
            content: row.content ?? '',
            creator:
               membersById.get((row as { createdBy?: string | null }).createdBy ?? '') ??
               unknownMember((row as { createdBy?: string | null }).createdBy ?? 'unknown'),
            createdAt: audit(row, 'createdAt'),
            updatedAt: audit(row, 'updatedAt'),
         }));

      const folders: DocumentFolderItem[] = folderRows
         .filter((row) => row.teamId === teamId)
         .map((row) => ({
            id: row.id,
            name: row.name,
            icon: row.icon || '📁',
            documents: documents.filter((document) => document.folderId === row.id),
         }));

      const unfiled = documents.filter(
         (document) => !document.folderId || !folders.some((f) => f.id === document.folderId)
      );

      return [
         { id: UNFILED_FOLDER_ID, name: 'Team documents', icon: '📁', documents: unfiled },
         ...folders,
      ].filter((folder) => folder.documents.length > 0 || folder.id !== UNFILED_FOLDER_ID);
   }, [documentRows, folderRows, teamId, membersById]);
}

/* -------------------------------------------------------------------------- */
/*                             A project's updates                            */
/* -------------------------------------------------------------------------- */

/** One posted project update, ready for the Activity timeline. */
export interface ProjectUpdateItem {
   id: string;
   author: Member;
   /** ISO date the update was posted. */
   date: string;
   health: ProjectUpdateHealth;
   blocks: ContentBlock[];
}

/**
 * The updates posted on one project, newest first.
 *
 * The body is the same block JSON a comment and a description use, so an
 * update written in the composer and one written by an agent are one shape.
 */
export function useProjectUpdates(projectId: string): ProjectUpdateItem[] {
   const rows = useAblo((ablo) => ablo.projectUpdate.local.list({ where: { projectId } })) ?? [];
   const { membersById } = useWorkspace();

   return useMemo(() => {
      const postedAt = (row: (typeof rows)[number]) =>
         new Date((row as { createdAt?: string | Date }).createdAt ?? Date.now());

      return [...rows]
         .sort((a, b) => postedAt(b).getTime() - postedAt(a).getTime())
         .map((row) => ({
            id: row.id,
            author: membersById.get(row.authorId) ?? unknownMember(row.authorId),
            date: postedAt(row).toISOString(),
            health: row.health as ProjectUpdateHealth,
            blocks: parseContentBlocks(row.body),
         }));
   }, [rows, membersById]);
}

/** A row can outlive the person who wrote it; the feed still has to render. */
function unknownMember(id: string): Member {
   return {
      id,
      name: 'Unknown',
      email: '',
      avatarUrl: '',
      status: 'offline',
      role: 'Member',
      joinedDate: '',
      teamIds: [],
      timezone: 'UTC',
      type: 'human',
   };
}

/** All issues the viewer can see, newest rank first — the list's default order. */
export function useIssues(): HydratedIssue[] {
   const issueRows = useAblo((ablo) => ablo.issue.local.list({ orderBy: { rank: 'desc' } })) ?? [];
   const statuses = useStatuses();
   const labels = useLabels();
   const projects = useProjects();
   const { membersById } = useWorkspace();

   return useMemo(() => {
      const context: HydrateContext = {
         statusesById: new Map(statuses.map((s) => [s.id, s])),
         membersById,
         labelsById: new Map(labels.map((l) => [l.id, l])),
         projectsById: new Map(projects.map((p) => [p.id, p])),
      };

      return issueRows.map((row) => hydrateIssue(row, context));
   }, [issueRows, statuses, labels, projects, membersById]);
}

/* -------------------------------------------------------------------------- */
/*                              One issue's detail                            */
/* -------------------------------------------------------------------------- */

/**
 * Everything the detail view renders for one issue, live.
 *
 * Comments and events are separate models — a comment is written by a person or
 * an agent, an event is a record of a change — so they are merged here and
 * ordered by time, which is how the feed reads them.
 */
export function useIssueDetail(identifier: string): {
   issue: HydratedIssue | undefined;
   description: ContentBlock[];
   activity: ActivityItem[];
} {
   const issues = useIssues();
   const { membersById, viewerId } = useWorkspace();

   const issue = useMemo(
      () => issues.find((candidate) => candidate.identifier === identifier),
      [issues, identifier]
   );
   const issueId = issue?.id;

   // Read the models unconditionally and narrow below.
   //
   // These selectors used to return `[]` when `issueId` was not known yet —
   // which is every first render, because the issue is found in the synced pool
   // and the pool is empty until it arrives. A selector that returns early
   // touches no model, so the hook has nothing to subscribe to and never
   // re-runs: the feed rendered whatever had synced by the time it mounted and
   // then went deaf. Posting a comment did not show it to the person who wrote
   // it, and an agent's comment never appeared at all until a reload.
   const commentRows = useAblo((ablo) => ablo.comment.local.list({})) ?? [];
   const eventRows = useAblo((ablo) => ablo.issueActivity.local.list({})) ?? [];

   const description = useMemo(() => parseContentBlocks(issue?.description), [issue?.description]);

   const activity = useMemo<ActivityItem[]>(() => {
      if (!issueId) return [];

      const comments: { at: number; item: ActivityItem }[] = commentRows
         .filter((row) => row.issueId === issueId)
         .map((row) => {
            const at = new Date((row as { createdAt?: string | Date }).createdAt ?? Date.now());
            return {
               at: at.getTime(),
               item: {
                  kind: 'comment',
                  id: row.id,
                  actor: membersById.get(row.authorId) ?? unknownMember(row.authorId),
                  timeAgo: `${formatDistanceToNowStrict(at)} ago`,
                  body: parseContentBlocks(row.body),
                  // Stored as `{ emoji: [userId, …] }`, so who reacted is
                  // known — which is what makes a reaction a toggle rather
                  // than a counter that only goes up.
                  reactions: Object.entries(
                     (row.reactions as Record<string, string[]> | undefined) ?? {}
                  )
                     .filter(([, who]) => who.length > 0)
                     .map(([emoji, who]) => ({
                        emoji,
                        count: who.length,
                        mine: who.includes(viewerId),
                     })),
                  reactionsBy: (row.reactions as Record<string, string[]> | undefined) ?? {},
               },
            };
         });

      const events: { at: number; item: ActivityItem }[] = eventRows
         .filter((row) => row.issueId === issueId)
         .map((row) => {
            const at = new Date((row as { createdAt?: string | Date }).createdAt ?? Date.now());
            const payload = (row.payload as { text?: string } | undefined) ?? {};
            return {
               at: at.getTime(),
               item: {
                  kind: 'event',
                  id: row.id,
                  actor: membersById.get(row.actorId) ?? unknownMember(row.actorId),
                  event: row.type,
                  text: payload.text ?? row.type,
                  timeAgo: `${formatDistanceToNowStrict(at)} ago`,
               },
            };
         });

      return [...comments, ...events].sort((a, b) => a.at - b.at).map((entry) => entry.item);
   }, [commentRows, eventRows, issueId, membersById, viewerId]);

   return { issue, description, activity };
}

/**
 * A description is stored as the block JSON the editor produces. Anything that
 * is not valid block JSON — a plain string typed before this existed — still
 * renders, as a single paragraph.
 */
function parseContentBlocks(value: string | undefined): ContentBlock[] {
   if (!value) return [];
   try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as ContentBlock[];
   } catch {
      // not JSON — fall through
   }
   return [{ type: 'paragraph', text: value }];
}

/* -------------------------------------------------------------------------- */
/*                                    Teams                                   */
/* -------------------------------------------------------------------------- */

/**
 * Teams in the shape the navigation and team views expect.
 *
 * `joined` used to be a fixed flag in the fixtures; it is now a fact about the
 * signed-in person, so the sidebar shows their teams rather than everyone's.
 */
export function useTeams(): Team[] {
   const { teams, members, myTeamIds } = useWorkspace();
   const projects = useProjects();

   return useMemo(
      () =>
         teams.map((team) => ({
            id: team.id,
            name: team.name,
            icon: team.icon ?? '📋',
            color: team.color ?? '#95a2b3',
            joined: myTeamIds.has(team.id),
            members: members.filter((member) => member.teamIds.includes(team.id)),
            projects: projects.filter((project) => project.teamId === team.id),
         })),
      [teams, members, myTeamIds, projects]
   );
}

/** Cycles for the workspace, newest number first. */
export function useCycles(): Cycle[] {
   const rows = useAblo((ablo) => ablo.cycle.local.list({ orderBy: { number: 'desc' } })) ?? [];

   return useMemo(
      () =>
         rows.map((row) => ({
            id: row.id,
            number: row.number,
            name: row.name,
            teamId: row.teamId,
            status: row.status,
            startDate: row.startDate,
            endDate: row.endDate,
            capacity: row.capacity,
            // Scope and progress are counts over issues, so they are computed
            // by the views that show them rather than stored on the row.
            scope: 0,
            scopeDelta: 0,
            started: 0,
            completed: 0,
         })),
      [rows]
   );
}

/** The cycle a team is in now, and the one after it. */
export function useTeamCycles(teamId: string | undefined): {
   current: Cycle | undefined;
   upcoming: Cycle | undefined;
} {
   const cycles = useCycles();
   return useMemo(() => {
      const forTeam = teamId ? cycles.filter((cycle) => cycle.teamId === teamId) : cycles;
      return {
         current: forTeam.find((cycle) => cycle.status === 'current'),
         upcoming: forTeam.find((cycle) => cycle.status === 'upcoming'),
      };
   }, [cycles, teamId]);
}

/* -------------------------------------------------------------------------- */
/*                                Issue links                                 */
/* -------------------------------------------------------------------------- */

/** A linked issue, plus the id of the row that links it — so it can be undone. */
export interface LinkedIssue {
   linkId: string;
   issue: HydratedIssue;
}

export interface IssueLinks {
   /** Issues this one is waiting on. */
   blockedBy: LinkedIssue[];
   /** Issues waiting on this one. */
   blocking: LinkedIssue[];
   related: LinkedIssue[];
   duplicates: LinkedIssue[];
}

/**
 * The issues an issue is tied to.
 *
 * A link row is directional — `issueId` blocks `relatedIssueId` — so "blocked
 * by" is the same rows read from the other end rather than a second row that
 * could drift out of agreement with the first.
 */
export function useIssueLinks(issueId: string | undefined): IssueLinks {
   const issues = useIssues();
   const rows = useAblo((ablo) => ablo.issueLink.local.list({})) ?? [];

   return useMemo(() => {
      const byId = new Map(issues.map((issue) => [issue.id, issue]));
      const resolve = (id: string) => byId.get(id);
      const empty: IssueLinks = { blockedBy: [], blocking: [], related: [], duplicates: [] };
      if (!issueId) return empty;

      for (const row of rows) {
         const isSource = row.issueId === issueId;
         const isTarget = row.relatedIssueId === issueId;
         if (!isSource && !isTarget) continue;

         const other = resolve(isSource ? row.relatedIssueId : row.issueId);
         if (!other) continue;

         const linked: LinkedIssue = { linkId: row.id, issue: other };
         if (row.type === 'blocks') (isSource ? empty.blocking : empty.blockedBy).push(linked);
         else if (row.type === 'related') empty.related.push(linked);
         else empty.duplicates.push(linked);
      }
      return empty;
   }, [rows, issues, issueId]);
}

export interface IssuePullRequest {
   id: string;
   url: string;
   title: string;
   state: 'open' | 'merged' | 'closed' | 'draft';
}

/**
 * The pull requests attached to an issue.
 *
 * These are links people pasted, not the output of a GitHub integration —
 * there isn't one. The panel used to render fabricated PR numbers and statuses
 * next to real issue data, which is the worst place for a fixture to be.
 */
export function useIssuePullRequests(issueId: string | undefined): IssuePullRequest[] {
   const rows = useAblo((ablo) => ablo.issuePullRequest.local.list({})) ?? [];
   return useMemo(
      () =>
         issueId
            ? rows
                 .filter((row) => row.issueId === issueId)
                 .map((row) => ({
                    id: row.id,
                    url: row.url,
                    title: row.title,
                    state: row.state as IssuePullRequest['state'],
                 }))
            : [],
      [rows, issueId]
   );
}

/** The project milestone an issue is attached to, if any. */
export function useIssueMilestone(issue: { milestoneId?: string } | undefined) {
   const rows = useAblo((ablo) => ablo.projectMilestone.local.list({})) ?? [];
   return useMemo(
      () => (issue?.milestoneId ? rows.find((row) => row.id === issue.milestoneId) : undefined),
      [rows, issue?.milestoneId]
   );
}
