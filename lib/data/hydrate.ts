/**
 * Turns flat Ablo rows into the object graph the UI already renders.
 *
 * The components were written against `lib/domain`'s shapes — `issue.status` is
 * a Status with an icon component, `issue.assignee` is a User — while a synced
 * row carries ids. Rather than rewrite every view, the join happens here, once,
 * at the seam. Reference data (statuses, labels, projects, people) is small and
 * already in memory, so this is a map lookup per issue.
 */
import type { InferRow } from '@abloatai/ablo/schema';
import type { schema } from '@/ablo/schema';
import type { Member } from '@/lib/data/members';
import type { Issue } from '@/lib/domain/issues';
import type { LabelInterface } from '@/lib/domain/labels';
import { priorities, type Priority } from '@/lib/domain/priorities';
import type { Initiative } from '@/lib/domain/initiatives';
import type { Project } from '@/lib/domain/projects';
import { health as healthOptions } from '@/lib/domain/projects';
import { status as seedStatuses, type Status, type StatusCategory } from '@/lib/domain/status';

/**
 * Audit columns every synced row carries at runtime. This version types only
 * `id` as a base field, but the engine returns these too — verified against a
 * live row — so they are declared here rather than added to the schema, where
 * they would become part of the write surface.
 */
export interface AuditFields {
   createdAt: string | Date;
   updatedAt: string | Date;
   organizationId: string;
   createdBy?: string | null;
}

/**
 * A row as the reactive local reads hand it back: declared fields only, with
 * no relation accessors or instance helpers. `Model<…>` includes both and so
 * does not describe what `local.list` returns.
 *
 * The schema is named explicitly rather than relying on the `Register` merge in
 * ablo/register.ts, which does not resolve through the facade package here —
 * every field comes back `unknown` if you use the one-parameter form.
 */
export type Row<K extends keyof typeof schema.models> = InferRow<typeof schema, K> &
   Partial<AuditFields>;

export type IssueRow = Row<'issue'>;
export type WorkflowStateRow = Row<'workflowState'>;
export type LabelRow = Row<'label'>;
export type ProjectRow = Row<'project'>;
export type ProjectUpdateRow = Row<'projectUpdate'>;
export type InitiativeRow = Row<'initiative'>;

/** Priority is a fixed scale stored as 0–4; the UI wants the object. */
const PRIORITY_BY_LEVEL: Priority[] = [
   priorities.find((p) => p.id === 'no-priority')!,
   priorities.find((p) => p.id === 'low')!,
   priorities.find((p) => p.id === 'medium')!,
   priorities.find((p) => p.id === 'high')!,
   priorities.find((p) => p.id === 'urgent')!,
];

export function priorityFromLevel(level: number): Priority {
   return PRIORITY_BY_LEVEL[level] ?? PRIORITY_BY_LEVEL[0];
}

export function levelFromPriority(priorityId: string): number {
   const index = PRIORITY_BY_LEVEL.findIndex((p) => p.id === priorityId);
   return index === -1 ? 0 : index;
}

/**
 * Icons are components, so they are never stored. A state keeps the seed icon
 * when it kept the seed id, and otherwise borrows the one for its category —
 * which is what makes a workspace created at sign-up render correctly.
 */
const ICON_BY_SEED_ID = new Map(seedStatuses.map((s) => [s.id, s.icon]));
const ICON_BY_CATEGORY = new Map<StatusCategory, Status['icon']>(
   seedStatuses.map((s) => [s.category, s.icon])
);

export function hydrateStatus(row: WorkflowStateRow): Status {
   const category = row.category as StatusCategory;
   const icon =
      ICON_BY_SEED_ID.get(row.id) ??
      ICON_BY_SEED_ID.get(row.id.split('_').pop() ?? '') ??
      ICON_BY_CATEGORY.get(category) ??
      seedStatuses[0].icon;

   return { id: row.id, name: row.name, color: row.color, category, icon };
}

const PROJECT_ICON = seedStatuses[0].icon; // placeholder; project icons resolve below

export function hydrateProject(
   row: ProjectRow,
   statusesById: Map<string, Status>,
   membersById: Map<string, Member>,
   projectIcon: Project['icon']
): Project {
   return {
      id: row.id,
      name: row.name,
      summary: row.summary ?? '',
      description: row.description ?? '',
      icon: projectIcon,
      status: statusesById.get(row.statusId) ?? hydrateFallbackStatus(row.statusId),
      percentComplete: row.percentComplete,
      startDate: row.startDate ?? '',
      targetDate: row.targetDate ?? undefined,
      lead: (row.leadId && membersById.get(row.leadId)) || membersById.values().next().value!,
      priority: priorityFromLevel(row.priority),
      health: healthOptions.find((h) => h.id === row.health) ?? healthOptions[0],
      teamId: row.teamId,
      labels: [],
      initiative: row.initiativeId ?? undefined,
   };
}

/**
 * An initiative, with the projects that name it.
 *
 * The fixture kept `projectIds` on the initiative; the database keeps
 * `initiativeId` on the project, which is the same edge from the side that can
 * actually be written from a project page. It is inverted here so the views
 * that were built against the fixture keep working.
 */
export function hydrateInitiative(
   row: InitiativeRow,
   membersById: Map<string, Member>,
   projects: Project[]
): Initiative {
   return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      icon: row.icon || '🎯',
      status: row.status as Initiative['status'],
      priority: priorityFromLevel(row.priority),
      owner: row.ownerId ? membersById.get(row.ownerId) : undefined,
      target: row.target ?? undefined,
      health: healthOptions.find((h) => h.id === row.health) ?? healthOptions[0],
      projectIds: projects
         .filter((project) => project.initiative === row.id)
         .map((project) => project.id),
      createdAt: toIsoDate(row.createdAt),
   };
}

function hydrateFallbackStatus(id: string): Status {
   return { id, name: 'Unknown', color: '#95a2b3', category: 'backlog', icon: PROJECT_ICON };
}

/**
 * A json field is typed `unknown` and can arrive either already parsed (jsonb
 * from the snapshot) or as the raw JSON string the model runtime stores, so
 * both are accepted rather than assuming one.
 */
function toLabelIds(row: unknown): string[] {
   const source = row as { labelIds?: unknown; labelIdsJson?: unknown };
   const value = source.labelIdsJson ?? source.labelIds;
   const parsed =
      typeof value === 'string'
         ? (() => {
              try {
                 return JSON.parse(value);
              } catch {
                 return [];
              }
           })()
         : value;
   return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

/** Postgres hands back '2026-07-21 00:00:00+00'; the UI formats ISO strings. */
function toIsoDate(value: string | Date | undefined): string {
   if (!value) return new Date().toISOString();
   const date = value instanceof Date ? value : new Date(value);
   return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/**
 * The mock `Issue` shape plus the fields a synced row has and it does not.
 * `teamId` is the important one: the mock had no team on an issue at all, so
 * nothing could scope a list to the team you are looking at.
 */
export interface HydratedIssue extends Issue {
   /** Who opened it. The fixtures had no creator and hashed one instead. */
   createdBy?: string;
   /**
    * Optional only so views still reading `lib/domain` keep type-checking while
    * they are converted slice by slice; every row from `useIssues` carries it.
    */
   teamId?: string;
   parentIssueId?: string;
   milestoneId?: string;
}

export interface HydrateContext {
   statusesById: Map<string, Status>;
   membersById: Map<string, Member>;
   labelsById: Map<string, LabelInterface>;
   projectsById: Map<string, Project>;
}

export function hydrateIssue(row: IssueRow, context: HydrateContext): HydratedIssue {
   return {
      id: row.id,
      teamId: row.teamId,
      createdBy: row.createdBy ?? undefined,
      parentIssueId: row.parentIssueId ?? undefined,
      milestoneId: row.milestoneId ?? undefined,
      identifier: row.identifier,
      title: row.title,
      description: row.description ?? '',
      status: context.statusesById.get(row.statusId) ?? hydrateFallbackStatus(row.statusId),
      assignee: (row.assigneeId && context.membersById.get(row.assigneeId)) || null,
      priority: priorityFromLevel(row.priority),
      labels: toLabelIds(row)
         .map((labelId) => context.labelsById.get(labelId))
         .filter((label): label is LabelInterface => Boolean(label)),
      createdAt: toIsoDate(row.createdAt),
      cycleId: row.cycleId ?? '',
      project: row.projectId ? context.projectsById.get(row.projectId) : undefined,
      rank: row.rank,
      // `due_date` is a date column, so it comes back as an ISO timestamp; the
      // UI writes and shows a plain yyyy-MM-dd.
      dueDate: row.dueDate ? String(row.dueDate).slice(0, 10) : undefined,
   };
}
