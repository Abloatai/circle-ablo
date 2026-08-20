/**
 * Turns `lib/domain/*` into real rows.
 *
 * Note the `db:seed` script chains `ablo connect resnapshot`: rows written
 * straight to Postgres do not reach Ablo's clients until it reloads them, while
 * writes made through Ablo appear at once. Seeding is the former.
 *
 * The mock modules stay in the repo as the seed: they already encode a
 * plausible workspace (people, teams, cycles, ~150 issues), and re-deriving
 * that by hand would be worse data. What they cannot express is written here —
 * every issue gets a team, every person gets an account they can sign in with,
 * and one member is an agent.
 *
 * Run: pnpm db:seed   (destructive — it clears the work tables first)
 */
import { sql } from 'drizzle-orm';
import { sync } from '../ablo';
import { db, getPool } from './index';
import * as t from './schema';
import { auth } from '../lib/auth';
import { users as mockUsers } from '../lib/domain/users';
import { teams as mockTeams } from '../lib/domain/teams';
import { status as mockStatuses } from '../lib/domain/status';
import { labels as mockLabels } from '../lib/domain/labels';
import { projects as mockProjects } from '../lib/domain/projects';
import { cycles as mockCycles } from '../lib/domain/cycles';
import { initiatives as mockInitiatives } from '../lib/domain/initiatives';
import { issues as mockIssues } from '../lib/domain/issues';
import { getIssueDetail } from '../lib/domain/issue-details';
import { getProjectDetail } from '../lib/domain/project-details';
import { DEV_PASSWORD } from './dev-password';
import { views as mockViews } from '../lib/domain/views';

const ORG_ID = 'org_circle';
const ORG_SLUG = 'circle';

const PRIORITY_LEVEL: Record<string, 0 | 1 | 2 | 3 | 4> = {
   'no-priority': 0,
   'low': 1,
   'medium': 2,
   'high': 3,
   'urgent': 4,
};

const now = new Date();

/** The mock feed says '12d ago'; a row needs a timestamp. */
function timeAgoToDate(timeAgo: string): Date {
   const match = /^(\d+)\s*([mhdw])/.exec(timeAgo.trim());
   if (!match) return now;
   const amount = Number(match[1]);
   const ms = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[match[2]] ?? 0;
   return new Date(now.getTime() - amount * ms);
}

/**
 * Icons are components; the database stores a registry key instead. Lucide
 * icons are forwardRef objects rather than functions, so the name lives on
 * `displayName` (or on the inner render function), not on `fn.name`.
 */
function iconKey(icon: unknown): string | null {
   if (!icon || (typeof icon !== 'function' && typeof icon !== 'object')) return null;
   const candidate = icon as { displayName?: string; name?: string; render?: { name?: string } };
   return candidate.displayName ?? candidate.render?.name ?? candidate.name ?? null;
}

async function main() {
   console.log('clearing work tables…');
   await db.execute(sql`
      truncate table
         issue_counter, issue_link, issue_activity, comment, issue, cycle,
         project_label, project_milestone, project_update, project_resource, project,
         initiative, label, workflow_state, notification, document, document_folder,
         saved_view, agent_message, agent_run,
         team_member, member, invitation, team, organization, session, account, "user"
      restart identity cascade
   `);

   /* ------------------------------- identity ------------------------------- */

   console.log('organization + people…');
   await db.insert(t.organization).values({
      id: ORG_ID,
      name: 'Circle',
      slug: ORG_SLUG,
      createdAt: now,
   });

   // Better Auth hashes with its own configured hasher; borrow it so the seeded
   // accounts are indistinguishable from ones created through sign-up.
   const ctx = await auth.$context;
   const passwordHash = await ctx.password.hash(DEV_PASSWORD);

   const people = [
      ...mockUsers.map((u) => ({
         id: u.id,
         name: u.name,
         email: u.email,
         image: u.avatarUrl,
         type: 'human' as const,
         status: u.status,
         timezone: u.timezone,
         teamIds: u.teamIds,
         admin: u.role === 'Admin',
      })),
      {
         // The agent teammate. Assignable exactly like a person, which is what
         // makes "hand this issue to an agent" a normal assignment.
         id: 'scout',
         name: 'scout',
         email: 'scout@agents.example.com',
         image: 'https://api.dicebear.com/9.x/glass/svg?seed=scout',
         type: 'agent' as const,
         status: 'online',
         timezone: 'UTC',
         teamIds: mockTeams.map((team) => team.id),
         admin: false,
      },
   ];

   await db.insert(t.user).values(
      people.map((p) => ({
         id: p.id,
         name: p.name,
         email: p.email,
         emailVerified: true,
         image: p.image,
         type: p.type,
         status: p.status,
         timezone: p.timezone,
         createdAt: now,
         updatedAt: now,
      }))
   );

   await db.insert(t.account).values(
      people.map((p) => ({
         id: `acct_${p.id}`,
         accountId: p.id,
         providerId: 'credential',
         userId: p.id,
         password: passwordHash,
         createdAt: now,
         updatedAt: now,
      }))
   );

   await db.insert(t.member).values(
      people.map((p) => ({
         id: `mem_${p.id}`,
         organizationId: ORG_ID,
         userId: p.id,
         role: p.admin ? 'owner' : 'member',
         createdAt: now,
      }))
   );

   console.log('teams…');
   await db.insert(t.team).values(
      mockTeams.map((team) => ({
         id: team.id,
         name: team.name,
         organizationId: ORG_ID,
         key: team.id,
         icon: team.icon,
         color: team.color,
         createdAt: now,
         updatedAt: now,
      }))
   );

   const teamIds = new Set(mockTeams.map((team) => team.id));
   await db.insert(t.teamMember).values(
      people.flatMap((p) =>
         p.teamIds
            .filter((id) => teamIds.has(id))
            .map((teamId) => ({
               id: `tm_${p.id}_${teamId}`,
               teamId,
               userId: p.id,
               createdAt: now,
            }))
      )
   );

   /* ------------------------------ work domain ----------------------------- */

   // `abloTenantId` is Ablo's tenancy column, distinct from the application's
   // organization; rows seeded straight into Postgres have to carry it or the
   // sync layer filters them out of every read — and Ablo refuses to commit to
   // a model that is not row-local tenant scoped at all. It is read from the
   // credential rather than configured, because a forgotten env var here is
   // invisible: the rows land fine and simply never appear in the app.
   await sync.ready();
   const abloTenantId = sync.identity?.organizationId ?? null;
   if (!abloTenantId) throw new Error('Could not resolve the Ablo tenant id from ABLO_API_KEY');
   console.log('ablo tenant:', abloTenantId);

   const base = {
      organizationId: ORG_ID,
      abloTenantId,
      createdBy: 'ln',
      createdAt: now,
      updatedAt: now,
   };

   console.log('workflow states + labels…');
   await db.insert(t.workflowState).values(
      mockStatuses.map((s, i) => ({
         ...base,
         id: s.id,
         name: s.name,
         color: s.color,
         category: s.category,
         position: i,
      }))
   );

   await db
      .insert(t.label)
      .values(mockLabels.map((l) => ({ ...base, id: l.id, name: l.name, color: l.color })));

   console.log('initiatives…');
   await db.insert(t.initiative).values(
      mockInitiatives.map((i) => ({
         ...base,
         id: i.id,
         name: i.name,
         description: i.description ?? null,
         icon: i.icon,
         status: i.status,
         priority: PRIORITY_LEVEL[i.priority.id] ?? 0,
         ownerId: i.owner?.id ?? null,
         target: i.target ?? null,
         health: i.health.id,
         createdAt: new Date(i.createdAt),
      }))
   );

   const initiativeOfProject = new Map<string, string>();
   for (const i of mockInitiatives) {
      for (const projectId of i.projectIds) initiativeOfProject.set(projectId, i.id);
   }

   console.log('projects…');
   await db.insert(t.project).values(
      mockProjects.map((p) => ({
         ...base,
         id: p.id,
         teamId: p.teamId,
         name: p.name,
         // The prose lives on the project now, not in a fixture the page reads.
         summary: getProjectDetail(p.id).summary,
         description: JSON.stringify(getProjectDetail(p.id).description),
         icon: iconKey(p.icon),
         statusId: p.status.id,
         percentComplete: p.percentComplete,
         startDate: p.startDate || null,
         targetDate: p.targetDate ?? null,
         leadId: p.lead.id,
         priority: PRIORITY_LEVEL[p.priority.id] ?? 0,
         health: p.health.id,
         healthUpdatedAt:
            p.healthUpdatedAgoDays === undefined
               ? null
               : new Date(now.getTime() - p.healthUpdatedAgoDays * 86_400_000),
         initiativeId: initiativeOfProject.get(p.id) ?? null,
      }))
   );

   const projectLabels = mockProjects.flatMap((p) =>
      p.labels.map((l) => ({ ...base, id: `pl_${p.id}_${l.id}`, projectId: p.id, labelId: l.id }))
   );
   if (projectLabels.length) await db.insert(t.projectLabel).values(projectLabels);

   // The handcrafted health write-ups on the Activity tab. Their bodies become
   // the same block JSON a comment and a description use, so an update seeded
   // here and one posted in the composer are indistinguishable.
   const projectUpdates = mockProjects.flatMap((p) =>
      getProjectDetail(p.id).updates.map((u) => ({
         ...base,
         id: `pu_${p.id}_${u.id}`,
         teamId: p.teamId,
         projectId: p.id,
         authorId: u.author.id,
         health: u.health,
         body: JSON.stringify(u.blocks),
         createdAt: new Date(u.date),
         updatedAt: new Date(u.date),
      }))
   );
   if (projectUpdates.length) {
      console.log(`project updates (${projectUpdates.length})…`);
      await db.insert(t.projectUpdate).values(projectUpdates);
   }

   // Milestones and linked resources, from the handcrafted project details.
   const milestones = mockProjects.flatMap((p) =>
      getProjectDetail(p.id).milestones.map((m, index) => ({
         ...base,
         id: `pm_${p.id}_${m.id}`,
         teamId: p.teamId,
         projectId: p.id,
         name: m.name,
         targetDate: m.targetDate ?? null,
         done: m.completed,
         position: index,
      }))
   );
   if (milestones.length) {
      console.log(`project milestones (${milestones.length})…`);
      await db.insert(t.projectMilestone).values(milestones);
   }

   const resources = mockProjects.flatMap((p) =>
      getProjectDetail(p.id).resources.map((r, index) => ({
         ...base,
         id: `pr_${p.id}_${index}`,
         teamId: p.teamId,
         projectId: p.id,
         title: r.label,
         url: r.url,
      }))
   );
   if (resources.length) {
      console.log(`project resources (${resources.length})…`);
      await db.insert(t.projectResource).values(resources);
   }

   // Saved views. The type has no column of its own — it rides in the json
   // beside the filter it describes, which is what `useSavedViews` reads.
   console.log(`saved views (${mockViews.length})…`);
   await db.insert(t.savedView).values(
      mockViews.map((v) => ({
         ...base,
         id: v.id,
         teamId: v.teamId ?? null,
         name: v.name,
         icon: v.icon,
         description: v.description,
         filters: { type: v.type, filter: v.filter },
         createdBy: v.owner.id,
         createdAt: new Date(v.createdAt),
         updatedAt: new Date(v.updatedAt),
      }))
   );

   console.log('cycles…');
   await db.insert(t.cycle).values(
      mockCycles.map((c) => ({
         ...base,
         id: c.id,
         teamId: c.teamId,
         number: c.number,
         name: c.name,
         status: c.status,
         startDate: c.startDate,
         endDate: c.endDate,
         capacity: c.capacity,
      }))
   );

   /* --------------------------------- issues -------------------------------- */

   // The mock issues have no team of their own: they reach one through their
   // project or their cycle. Resolve it once here so the column is never null,
   // because team is what an issue's sync group is named after.
   const teamOfProject = new Map(mockProjects.map((p) => [p.id, p.teamId]));
   const teamOfCycle = new Map(mockCycles.map((c) => [c.id, c.teamId]));
   const fallbackTeam = mockTeams[0].id;

   console.log(`issues (${mockIssues.length})…`);
   await db.insert(t.issue).values(
      mockIssues.map((issue) => ({
         ...base,
         id: issue.id,
         teamId:
            (issue.project && teamOfProject.get(issue.project.id)) ||
            teamOfCycle.get(issue.cycleId) ||
            fallbackTeam,
         identifier: issue.identifier,
         title: issue.title,
         description: JSON.stringify(getIssueDetail(issue).description),
         statusId: issue.status.id,
         assigneeId: issue.assignee?.id ?? null,
         priority: PRIORITY_LEVEL[issue.priority.id] ?? 0,
         cycleId: issue.cycleId || null,
         projectId: issue.project?.id ?? null,
         rank: issue.rank,
         labelIds: issue.labels.map((l) => l.id),
         dueDate: issue.dueDate ?? null,
         completedAt: issue.status.category === 'completed' ? new Date(issue.createdAt) : null,
         createdBy: issue.assignee?.id ?? 'ln',
         createdAt: new Date(issue.createdAt),
      }))
   );

   // Blocked-by and related links, from the handcrafted details.
   const issueByIdentifier = new Map(mockIssues.map((issue) => [issue.identifier, issue]));
   const links: (typeof t.issueLink.$inferInsert)[] = [];
   for (const issue of mockIssues) {
      const detail = getIssueDetail(issue);
      const teamId =
         (issue.project && teamOfProject.get(issue.project.id)) ||
         teamOfCycle.get(issue.cycleId) ||
         fallbackTeam;

      for (const identifier of detail.blockedByIds ?? []) {
         const blocker = issueByIdentifier.get(identifier);
         // Directional: the blocker is the source, so "blocked by" is the
         // same row read from the other end.
         if (blocker) {
            links.push({
               ...base,
               id: `lnk_${blocker.id}_${issue.id}_blocks`,
               teamId,
               issueId: blocker.id,
               relatedIssueId: issue.id,
               type: 'blocks',
            });
         }
      }
      for (const identifier of detail.relatedIds ?? []) {
         const related = issueByIdentifier.get(identifier);
         if (related && related.id < issue.id) {
            links.push({
               ...base,
               id: `lnk_${related.id}_${issue.id}_related`,
               teamId,
               issueId: related.id,
               relatedIssueId: issue.id,
               type: 'related',
            });
         }
      }
   }
   if (links.length) {
      console.log(`issue links (${links.length})…`);
      await db.insert(t.issueLink).values(links);
   }

   // Issue numbering continues from the seeded issues rather than restarting.
   // Every team starts above the highest number in the workspace, not its own.
   // The seeded issues all share one `LNUI-` prefix, so a per-team maximum would
   // hand out a number another team already used — and identifiers are unique
   // per workspace, not per team.
   await db.execute(sql`
      insert into issue_counter (team_id, organization_id, next)
      select team_id, organization_id,
             (select max(coalesce(substring(identifier from '[0-9]+$')::int, 0)) + 1 from issue)
      from issue group by team_id, organization_id
      on conflict (team_id) do update set next = excluded.next`);

   /* ------------------------- comments and activity ------------------------ */

   // The handcrafted issue details become real rows: comments the agent will
   // reply alongside, and the event feed it will write into.
   const comments: (typeof t.comment.$inferInsert)[] = [];
   const activity: (typeof t.issueActivity.$inferInsert)[] = [];

   for (const issue of mockIssues) {
      const detail = getIssueDetail(issue);
      const teamId =
         (issue.project && teamOfProject.get(issue.project.id)) ||
         teamOfCycle.get(issue.cycleId) ||
         fallbackTeam;

      for (const item of detail.activity) {
         const at = timeAgoToDate(item.timeAgo);
         if (item.kind === 'comment') {
            comments.push({
               ...base,
               id: `cmt_${issue.id}_${item.id}`,
               teamId,
               issueId: issue.id,
               authorId: item.actor.id,
               body: JSON.stringify(item.body),
               reactions: Object.fromEntries(
                  (item.reactions ?? []).map((r) => [r.emoji, Array(r.count).fill(item.actor.id)])
               ),
               createdBy: item.actor.id,
               createdAt: at,
               updatedAt: at,
            });
         } else {
            activity.push({
               ...base,
               id: `act_${issue.id}_${item.id}`,
               teamId,
               issueId: issue.id,
               actorId: item.actor.id,
               type: item.event,
               payload: { text: item.text },
               createdBy: item.actor.id,
               createdAt: at,
               updatedAt: at,
            });
         }
      }
   }

   console.log(`comments (${comments.length}) and activity (${activity.length})…`);
   for (let i = 0; i < comments.length; i += 500)
      await db.insert(t.comment).values(comments.slice(i, i + 500));
   for (let i = 0; i < activity.length; i += 500)
      await db.insert(t.issueActivity).values(activity.slice(i, i + 500));

   console.log(`
done.
   organization  ${ORG_SLUG}
   people        ${people.length} (1 agent: scout)
   teams         ${mockTeams.length}
   issues        ${mockIssues.length}
   sign in with  ${mockUsers[0].email} / ${DEV_PASSWORD}
`);
}

main()
   .catch((error) => {
      console.error(error);
      process.exitCode = 1;
   })
   .finally(async () => {
      await getPool().end();
   });
