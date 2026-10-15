import { expect, test } from '@playwright/test';
import type Ablo from '@abloatai/ablo';
import { presenceForSessions } from '@/lib/data/presence';

function session(
   id: string,
   updatedAt: string,
   operation: 'read' | 'update' = 'read'
): Ablo.PresenceSession {
   return {
      presenceSessionId: id,
      participant: { id: 'alice', kind: 'user' },
      activities: [
         {
            id,
            version: 1,
            operation,
            source: 'session',
            target: { model: 'issue', id: 'issue-uuid' },
            startedAt: updatedAt,
            updatedAt,
            expiresAt: '2026-10-15T00:00:00Z',
         },
      ],
   };
}

test('presence uses the latest activity across an actor’s sessions and resolves issue labels', () => {
   const result = presenceForSessions(
      [
         session('new', '2026-10-14T10:01:00Z', 'update'),
         session('old', '2026-10-14T12:00:00+02:00'),
      ],
      (id) => (id === 'issue-uuid' ? 'CORE-142' : undefined)
   );
   expect(result).toEqual([
      {
         userId: 'alice',
         isAgent: false,
         action: 'editing',
         entityType: 'issue',
         entityId: 'CORE-142',
         lastActive: '2026-10-14T10:01:00Z',
      },
   ]);
});

test('empty sessions disappear and unknown issue IDs remain readable', () => {
   const empty = { ...session('empty', '2026-10-14T10:00:00Z'), activities: [] };
   expect(presenceForSessions([empty], () => undefined)).toEqual([]);
   const agent = session('agent', '2026-10-14T10:00:00Z');
   agent.participant = { id: 'agent-1', kind: 'agent' };
   expect(presenceForSessions([agent], () => undefined)[0]).toMatchObject({
      userId: 'agent-1',
      isAgent: true,
      action: 'viewing',
      entityId: 'issue-uuid',
   });
});
