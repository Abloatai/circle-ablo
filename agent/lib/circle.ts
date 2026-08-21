/**
 * The agent's access to Circle's data.
 *
 * Least privilege is enforced here rather than in the prompt: a tool is given a
 * `runId`, loads that run with the project credential, and then mints a session
 * scoped to the run's team. The model never names a team, an issue outside its
 * run, or a capability — so a confused or adversarial turn cannot widen what
 * the agent can touch.
 */
import Ablo from '@abloatai/ablo';
import { identityAnchor, syncGroup } from '@abloatai/ablo/schema';
import { eq } from 'drizzle-orm';
import { schema } from '../../ablo/schema';
import { db } from '../../db';
import { agentRun } from '../../db/schema/app';

/** Project-scoped, server-only. Used to read the run record and mint tokens. */
const project = Ablo({ apiKey: process.env.ABLO_API_KEY, schema, transport: 'http' });

export interface RunContext {
   runId: string;
   /** Who handed the work over — they hear about progress. */
   requestedById: string;
   /** The application's organization — every write has to name it. */
   organizationId: string;
   issueId: string | undefined;
   teamId: string;
   agentUserId: string;
   prompt: string;
   /**
    * Scoped to this run's team, with only the operations the agent needs.
    * Typed off the constructed value — the docs are explicit that
    * `ReturnType<typeof Ablo>` collapses to the untyped overload.
    */
   ablo: typeof project;
}

export async function loadRun(runId: string): Promise<RunContext> {
   // Read the run straight from Postgres. It is our own control data, not
   // something humans and agents edit concurrently, so it needs no coordination
   // — and a plain read avoids the sync layer's indexed-read quirks.
   const [run] = await db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
   if (!run) throw new Error(`No agent run ${runId}`);

   await project.ready();

   const session = await project.sessions.create({
      agent: { id: run.agentUserId },
      can: {
         issue: ['read', 'update'],
         comment: ['read', 'create'],
         issuePullRequest: ['read'],
         issueActivity: ['read', 'create'],
         agentRun: ['read', 'update'],
         agentMessage: ['read', 'create'],
         notification: ['create'],
         workflowState: ['read'],
      },
      /**
       * The run's team, **and** its organization.
       *
       * The team anchor alone is not enough: `workflowState` is org-scoped, so
       * a team-only session reads zero statuses — and the agent then cannot
       * call `set_status` at all, because `get_assignment` hands it an empty
       * list of names to choose from. It said so itself in a comment before
       * this was found: "no status change was made because the assignment
       * returned no available statuses".
       *
       * This does not widen what the agent can do. The `can` list above is what
       * grants operations, and the only org-scoped model in it is
       * `workflowState`, read-only — which is exactly the reference data it
       * needs to name a status and nothing else.
       */
      syncGroups: [syncGroup('team', run.teamId), identityAnchor('org', run.organizationId)],
   });

   const ablo = Ablo({ apiKey: session.token, schema, transport: 'http' });
   await ablo.ready();

   return {
      runId,
      requestedById: run.requestedById,
      organizationId: run.organizationId,
      issueId: run.issueId ?? undefined,
      teamId: run.teamId,
      agentUserId: run.agentUserId,
      prompt: run.prompt,
      ablo,
   };
}

/**
 * Every row of a collection, not just the first page.
 *
 * Since 0.53 a server read is a page: the server applies a default size (20 at
 * the time of writing) and caps the largest, so a `list()` that returns fewer
 * rows than exist is normal, silent, and indistinguishable from a complete
 * read — `ModelList` is an array, so nothing complains. A tool that resolves a
 * status by name or reads a whole discussion has to walk the pages or it
 * reasons about a truncated set.
 */
export async function listAll<T>(
   readPage: (page: { cursor?: string }) => Promise<readonly T[] & { nextCursor: string | null }>
): Promise<T[]> {
   const rows: T[] = [];
   let cursor: string | undefined;

   // A cursor that does not advance would spin forever; stop rather than hang a
   // tool call, and let the caller work with what arrived.
   for (let page = 0; page < 1000; page += 1) {
      const batch = await readPage(cursor ? { cursor } : {});
      rows.push(...batch);
      if (!batch.nextCursor || batch.nextCursor === cursor) break;
      cursor = batch.nextCursor;
   }

   return rows;
}

/**
 * Every row of a collection that matches, narrowed here rather than by the
 * server.
 *
 * **A server `list({ where })` on a reference field matches nothing.** It
 * filters correctly on `id`, `title`, `identifier`, `rank`, `body` and
 * `description`, and returns zero rows — no error, still a well-typed array —
 * for every `*Id` field: `issueId`, `teamId`, `statusId`, `assigneeId`,
 * `projectId`, `authorId`. Measured on 0.55 across three models, in the object
 * form and in the `[[column, value]]` tuple form the server's own error message
 * documents. This tool read the discussion on its issue with
 * `where: { issueId }` and had been handing the model an empty one.
 *
 * The reactive client's `local.list({ where })` is unaffected — that filter runs
 * over the local pool — so this workaround belongs to the agent's HTTP client
 * and not to the browser's hooks.
 */
export async function listAllWhere<T>(
   readPage: (page: { cursor?: string }) => Promise<readonly T[] & { nextCursor: string | null }>,
   keep: (row: T) => boolean
): Promise<T[]> {
   return (await listAll(readPage)).filter(keep);
}

/** Body blocks match what the description and comment renderers already read. */
export function textBlocks(text: string) {
   return JSON.stringify(
      text
         .split(/\n{2,}/)
         .map((paragraph) => paragraph.trim())
         .filter(Boolean)
         .map((paragraph) => ({ type: 'paragraph', text: paragraph }))
   );
}

/** Keeps the run row current so the UI can show progress without polling eve. */
export async function reportStep(context: RunContext, currentStep: string) {
   await context.ablo.agentRun.update({
      id: context.runId,
      data: { status: 'running', currentStep },
   });
}

/**
 * A stable key for a write an agent may retry.
 *
 * eve retries a tool call when a connection drops, and the write underneath is
 * usually a `create` with a fresh `crypto.randomUUID()` — so the retry lands a
 * second comment rather than the same one. Ablo dedupes a commit carrying an
 * idempotency key it has already applied, which turns "retried" back into
 * "happened once".
 *
 * Keyed on the run and the content, so one run posting two different updates
 * still gets two.
 */
export function idempotencyKey(runId: string, kind: string, content: string): string {
   let hash = 0;
   for (let i = 0; i < content.length; i++) hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
   return `${runId}:${kind}:${hash.toString(36)}`;
}
