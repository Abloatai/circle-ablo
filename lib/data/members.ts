import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import type { User } from '@/lib/domain/users';

/**
 * The organization's people, in the shape the UI already renders.
 *
 * Identity lives in Better Auth's tables, not in Ablo: it changes rarely and
 * does not need live sync, so it is loaded once on the server and handed to
 * the client. Agents are ordinary rows here — an agent is a user whose `type`
 * is 'agent', which is what makes assigning work to one a normal assignment.
 */
export interface Member extends User {
   type: 'human' | 'agent';
}

export async function getMembers(organizationId: string): Promise<Member[]> {
   const rows = await db
      .select({
         id: t.user.id,
         name: t.user.name,
         email: t.user.email,
         image: t.user.image,
         type: t.user.type,
         status: t.user.status,
         timezone: t.user.timezone,
         createdAt: t.user.createdAt,
         role: t.member.role,
      })
      .from(t.member)
      .innerJoin(t.user, eq(t.user.id, t.member.userId))
      .where(eq(t.member.organizationId, organizationId));

   const teams = await db
      .select({ userId: t.teamMember.userId, teamId: t.teamMember.teamId })
      .from(t.teamMember)
      .innerJoin(t.team, eq(t.team.id, t.teamMember.teamId))
      .where(eq(t.team.organizationId, organizationId));

   const teamsByUser = new Map<string, string[]>();
   for (const row of teams) {
      const list = teamsByUser.get(row.userId) ?? [];
      list.push(row.teamId);
      teamsByUser.set(row.userId, list);
   }

   return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.image ?? '',
      status: (row.status as User['status']) ?? 'offline',
      role:
         row.type === 'agent'
            ? 'Application'
            : row.role === 'owner' || row.role === 'admin'
              ? 'Admin'
              : 'Member',
      joinedDate: row.createdAt.toISOString().slice(0, 10),
      teamIds: teamsByUser.get(row.id) ?? [],
      timezone: row.timezone ?? 'UTC',
      type: (row.type as Member['type']) ?? 'human',
   }));
}

export interface TeamSummary {
   id: string;
   key: string;
   name: string;
   icon: string | null;
   color: string | null;
}

export async function getTeams(organizationId: string): Promise<TeamSummary[]> {
   return db
      .select({
         id: t.team.id,
         key: t.team.key,
         name: t.team.name,
         icon: t.team.icon,
         color: t.team.color,
      })
      .from(t.team)
      .where(eq(t.team.organizationId, organizationId));
}
