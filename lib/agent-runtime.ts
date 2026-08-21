import 'server-only';

import { Client } from 'eve/client';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';

export function createAgentClient(): Client {
   const url = process.env.EVE_URL;
   if (!url && process.env.NODE_ENV === 'production') {
      throw new Error('EVE_URL is not set — the deployment does not know where the agent runs');
   }

   const secret = process.env.AGENT_CHANNEL_SECRET;
   const headers = secret
      ? { Authorization: `Basic ${Buffer.from(`circle:${secret}`).toString('base64')}` }
      : undefined;

   return new Client({ host: url ?? 'http://127.0.0.1:2000', headers });
}

export async function findWorkspaceAgent(
   organizationId: string,
   teamId: string,
   agentId?: string
): Promise<string | undefined> {
   const [agent] = await db
      .select({ id: t.user.id })
      .from(t.user)
      .innerJoin(
         t.member,
         and(eq(t.member.userId, t.user.id), eq(t.member.organizationId, organizationId))
      )
      .innerJoin(
         t.teamMember,
         and(eq(t.teamMember.userId, t.user.id), eq(t.teamMember.teamId, teamId))
      )
      .where(and(eq(t.user.type, 'agent'), ...(agentId ? [eq(t.user.id, agentId)] : [])))
      .limit(1);
   return agent?.id;
}
