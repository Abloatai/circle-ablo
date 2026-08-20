'use client';

/**
 * Creating notifications.
 *
 * They are written from the same place the change is made, through Ablo, so a
 * notification and the thing it announces are confirmed together and reach the
 * recipient over the same stream. Nobody is notified about their own action.
 */
/**
 * Only the one write this helper makes.
 *
 * Naming the whole client type here means matching the hook's overloads, and
 * this function does not care about the rest of the surface.
 */
interface NotificationWriter {
   notification: {
      create(input: {
         data: {
            workspaceId: string;
            userId: string;
            type: string;
            issueId?: string;
            actorId?: string;
         };
      }): Promise<unknown>;
   };
}

export interface NotifyInput {
   ablo: NotificationWriter | null;
   workspaceId: string;
   actorId: string;
   issueId: string;
   type: 'assignment' | 'comment' | 'mention' | 'status' | 'created';
   /** Who should hear about it; the actor is filtered out. */
   recipients: (string | null | undefined)[];
}

export async function notify({
   ablo,
   workspaceId,
   actorId,
   issueId,
   type,
   recipients,
}: NotifyInput): Promise<void> {
   if (!ablo) return;

   const targets = [...new Set(recipients.filter((id): id is string => Boolean(id)))].filter(
      (id) => id !== actorId
   );
   if (targets.length === 0) return;

   await Promise.all(
      targets.map((userId) =>
         ablo.notification
            .create({ data: { workspaceId, userId, type, issueId, actorId } })
            // A missed notification must never fail the change that caused it.
            .catch(() => undefined)
      )
   );
}
