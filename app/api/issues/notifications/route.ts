import { createHash } from 'node:crypto';
import { and, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getViewer } from '@/lib/session';

const input = z.discriminatedUnion('type', [
   z.object({ type: z.literal('comment'), commentId: z.string().min(1).max(200) }).strict(),
   z.object({ type: z.literal('assignment'), issueId: z.string().min(1).max(200) }).strict(),
]);

export async function POST(request: Request): Promise<Response> {
   const origin = request.headers.get('origin');
   try {
      if (
         request.headers.get('sec-fetch-site') === 'cross-site' ||
         (origin && new URL(origin).host !== request.headers.get('host'))
      ) {
         return new Response(null, { status: 403 });
      }
   } catch {
      return new Response(null, { status: 403 });
   }
   const viewer = await getViewer();
   if (!viewer) return new Response(null, { status: 401 });
   const parsed = input.safeParse(await request.json().catch(() => null));
   if (!parsed.success) return new Response(null, { status: 400 });
   const event = parsed.data;
   const [comment] =
      event.type === 'comment'
         ? await db
              .select()
              .from(t.comment)
              .where(
                 and(
                    eq(t.comment.id, event.commentId),
                    eq(t.comment.authorId, viewer.id),
                    eq(t.comment.organizationId, viewer.organizationId)
                 )
              )
              .limit(1)
         : [];
   if (event.type === 'comment' && !comment) return new Response(null, { status: 404 });
   const [issue] = await db
      .select()
      .from(t.issue)
      .where(
         and(
            eq(t.issue.id, event.type === 'assignment' ? event.issueId : comment!.issueId),
            eq(t.issue.organizationId, viewer.organizationId)
         )
      )
      .limit(1);
   if (!issue || !viewer.teamIds.includes(issue.teamId)) return new Response(null, { status: 404 });

   const recipients = new Set<string>(issue.assigneeId ? [issue.assigneeId] : []);
   if (event.type === 'comment') {
      if (issue.createdBy) recipients.add(issue.createdBy);
      const [comments, subscriptions] = await Promise.all([
         db
            .select({ userId: t.comment.authorId })
            .from(t.comment)
            .where(
               and(
                  eq(t.comment.issueId, issue.id),
                  eq(t.comment.organizationId, viewer.organizationId)
               )
            ),
         db
            .select({ userId: t.subscription.userId })
            .from(t.subscription)
            .where(
               and(
                  eq(t.subscription.organizationId, viewer.organizationId),
                  or(
                     and(
                        eq(t.subscription.entityType, 'issue'),
                        eq(t.subscription.entityId, issue.id)
                     ),
                     and(
                        eq(t.subscription.entityType, 'team'),
                        eq(t.subscription.entityId, issue.teamId)
                     )
                  )
               )
            ),
      ]);
      for (const row of [...comments, ...subscriptions]) recipients.add(row.userId);
   }
   recipients.delete(viewer.id);
   if (!recipients.size) return new Response(null, { status: 204 });
   // Derive recipients from persisted events, then restrict delivery to current team members.
   const members = await db
      .selectDistinct({ userId: t.teamMember.userId })
      .from(t.teamMember)
      .innerJoin(
         t.member,
         and(
            eq(t.member.userId, t.teamMember.userId),
            eq(t.member.organizationId, viewer.organizationId)
         )
      )
      .where(
         and(eq(t.teamMember.teamId, issue.teamId), inArray(t.teamMember.userId, [...recipients]))
      );
   if (members.length)
      await db
         .insert(t.notification)
         .values(
            members.map(({ userId }) => ({
               id: createHash('sha256')
                  .update(
                     JSON.stringify([
                        event.type,
                        comment?.id ?? issue.id,
                        comment ? null : issue.updatedAt,
                        userId,
                     ])
                  )
                  .digest('hex'),
               organizationId: viewer.organizationId,
               abloTenantId: issue.abloTenantId,
               userId,
               actorId: viewer.id,
               issueId: issue.id,
               type: event.type,
            }))
         )
         .onConflictDoNothing();
   return new Response(null, { status: 204 });
}
