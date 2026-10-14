import type Ablo from '@abloatai/ablo';

/** One person (or agent) currently connected to the workspace. */
export interface Presence {
   userId: string;
   isAgent: boolean;
   /** 'viewing', 'editing', 'idle', … — free-form, see `activityFor`. */
   action: string;
   /** What they are on: 'issue', 'project', 'team', 'view', … */
   entityType: string;
   entityId: string;
   /** Human-readable: "CORE-142", "Members". */
   detail?: string;
   /** ISO timestamp of their last frame. */
   lastActive: string;
}

/** Collapse multiple sessions to each actor's latest visible record activity. */
export function presenceForSessions(
   sessions: readonly Ablo.PresenceSession[],
   issueIdentifier: (id: string) => string | undefined
): Presence[] {
   const users = new Map<string, Presence>();
   for (const session of sessions) {
      for (const activity of session.activities) {
         const previous = users.get(session.participant.id);
         if (previous && Date.parse(previous.lastActive) >= Date.parse(activity.updatedAt))
            continue;
         const id = activity.target.id ?? '';
         users.set(session.participant.id, {
            userId: session.participant.id,
            isAgent: session.participant.kind === 'agent',
            action: activity.operation === 'read' ? 'viewing' : 'editing',
            entityType: activity.target.model,
            entityId: activity.target.model === 'issue' ? (issueIdentifier(id) ?? id) : id,
            lastActive: activity.updatedAt,
         });
      }
   }
   return [...users.values()];
}
