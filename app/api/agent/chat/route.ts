import { Client } from 'eve/client';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { sync } from '@/ablo';
import { getViewer } from '@/lib/session';

/**
 * A conversation with an agent.
 *
 * A chat is one `agentRun` with no issue attached — `issueId` is optional on
 * the model precisely so an agent can be asked something that is not about a
 * particular issue. The run holds the eve `sessionId`, so a follow-up attaches
 * to the same session and the agent keeps its context; every turn is a message
 * row, so the transcript is workspace data rather than something living in one
 * browser tab.
 *
 * Both halves of a turn are written through Ablo, which is what makes a
 * conversation visible to the rest of the team as it happens rather than only
 * to the person typing.
 */
/** How long a single turn may hold the request open. */
const TURN_DEADLINE_MS = Number(process.env.AGENT_TURN_DEADLINE_MS ?? 60_000);

export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { runId, prompt, teamId, agentUserId } = (await request.json()) as {
      runId?: string;
      prompt?: string;
      teamId?: string;
      agentUserId?: string;
   };

   const text = prompt?.trim();
   if (!text) return Response.json({ error: 'A message is required' }, { status: 400 });

   await sync.ready();

   const existing = runId ? await loadChatRun(runId, viewer.organizationId) : undefined;
   if (runId && !existing) return Response.json({ error: 'Unknown chat' }, { status: 404 });
   if (existing && !viewer.teamIds.includes(existing.teamId)) {
      return Response.json({ error: 'Not your team' }, { status: 403 });
   }

   const team = existing?.teamId ?? teamId ?? viewer.teamIds[0];
   if (!team || !viewer.teamIds.includes(team)) {
      return Response.json({ error: 'You are not on a team yet' }, { status: 400 });
   }

   const agentId = existing?.agentUserId ?? agentUserId ?? (await firstAgent());
   if (!agentId) return Response.json({ error: 'No agent in this workspace' }, { status: 400 });

   // A new chat is a new run; a follow-up reuses the one it belongs to.
   const run =
      existing ??
      (await sync.agentRun.create({
         data: {
            workspaceId: viewer.organizationId,
            agentUserId: agentId,
            requestedById: viewer.id,
            teamId: team,
            status: 'queued',
            prompt: text,
            startedAt: new Date(),
         },
      }));

   // The person's turn, recorded before the agent is reached — so a failure
   // leaves the question on screen rather than swallowing it.
   await sync.agentMessage.create({
      data: {
         workspaceId: viewer.organizationId,
         teamId: team,
         runId: run.id,
         authorId: viewer.id,
         kind: 'request',
         body: text,
      },
   });

   try {
      await sync.agentRun.update({ id: run.id, data: { status: 'running' } });

      const client = new Client({ host: agentHost(), headers: agentHeaders() });
      const message = [
         text,
         '',
         `runId: ${run.id}`,
         'This is a conversation, not an issue assignment. Answer directly.',
      ].join('\n');

      const turn = existing?.sessionId
         ? client.sessions
              .attach(existing.sessionId)
              .send(message)
              .then((r) => r.result())
         : client.sessions.create({ message }).then(({ response }) => response.result());

      /**
       * A turn is bounded here, and the bound is not a failure.
       *
       * An agent can legitimately think for a while, and a wedged one can think
       * forever — the first attempt at this awaited the turn with no deadline,
       * which held the HTTP request open until the browser gave up and left the
       * run stuck at `running`. The same shape as a connection pool with no
       * timeout: nothing is wrong except that nothing can ever finish.
       *
       * When the deadline passes the run stays `running` and the request
       * returns. The answer is not lost: the agent's `reply` tool writes it as
       * an `agentMessage`, which reaches the page over the sync stream whether
       * or not anyone is still holding this request.
       */
      const result = await Promise.race([
         turn,
         new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), TURN_DEADLINE_MS)
         ),
      ]);

      if (result === 'timeout') {
         // Do not mark it failed — it is still running, and its reply will
         // arrive on its own.
         void turn.catch(() => undefined);
         return Response.json({ runId: run.id, status: 'running', pending: true }, { status: 202 });
      }

      const reply = result.message?.trim();
      if (reply) {
         await sync.agentMessage.create({
            data: {
               workspaceId: viewer.organizationId,
               teamId: team,
               runId: run.id,
               authorId: agentId,
               kind: 'result',
               body: reply,
            },
         });
      }

      await sync.agentRun.update({
         id: run.id,
         data: {
            // `waiting` is the agent parked for the next message, which is what
            // a chat is between turns. Only `completed` finishes the run.
            status:
               result.status === 'waiting'
                  ? 'waiting'
                  : result.status === 'completed'
                    ? 'succeeded'
                    : 'failed',
            sessionId: result.sessionId,
            ...(reply ? { result: reply } : {}),
            ...(result.status === 'completed' ? { finishedAt: new Date() } : {}),
         },
      });

      return Response.json({ runId: run.id, reply: reply ?? null, status: result.status });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the agent runtime';
      // The failure is a row, not a toast: whoever opens the chat later needs to
      // see why it stopped.
      await sync.agentMessage.create({
         data: {
            workspaceId: viewer.organizationId,
            teamId: team,
            runId: run.id,
            authorId: agentId,
            kind: 'status',
            body: `Could not reach the agent: ${message}`,
         },
      });
      await sync.agentRun.update({
         id: run.id,
         data: { status: 'failed', error: message, finishedAt: new Date() },
      });
      return Response.json({ runId: run.id, error: message }, { status: 502 });
   }
}

/**
 * Reads the run directly rather than through Ablo — it is our own control data,
 * the same reason `agent/lib/circle.ts` does, and a plain read avoids the
 * indexed-read quirks of a server `list()`.
 */
async function loadChatRun(runId: string, organizationId: string) {
   const [row] = await db.select().from(t.agentRun).where(eq(t.agentRun.id, runId)).limit(1);
   if (!row || row.organizationId !== organizationId) return undefined;
   return {
      id: row.id,
      teamId: row.teamId,
      agentUserId: row.agentUserId,
      sessionId: row.sessionId ?? undefined,
   };
}

async function firstAgent(): Promise<string | undefined> {
   const [agent] = await db
      .select({ id: t.user.id })
      .from(t.user)
      .where(eq(t.user.type, 'agent'))
      .limit(1);
   return agent?.id;
}

/** See `app/api/agent/dispatch/route.ts` — same rules, same reasons. */
function agentHost(): string {
   const url = process.env.EVE_URL;
   if (url) return url;
   if (process.env.NODE_ENV === 'production') {
      throw new Error('EVE_URL is not set — the deployment does not know where the agent runs');
   }
   return 'http://127.0.0.1:2000';
}

function agentHeaders(): Record<string, string> | undefined {
   const secret = process.env.AGENT_CHANNEL_SECRET;
   if (!secret) return undefined;
   return { Authorization: `Basic ${Buffer.from(`circle:${secret}`).toString('base64')}` };
}
