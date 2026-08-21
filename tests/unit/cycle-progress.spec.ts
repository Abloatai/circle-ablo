import { expect, test } from '@playwright/test';
import { withCycleProgress, type Cycle } from '@/lib/domain/cycles';
import type { Issue } from '@/lib/domain/issues';

const cycle: Cycle = {
   id: 'cycle-1',
   number: 1,
   name: 'Cycle 1',
   teamId: 'team-1',
   status: 'completed',
   startDate: '2026-08-01',
   endDate: '2026-08-14',
   capacity: 100,
   scope: 0,
   scopeDelta: 0,
   started: 0,
   completed: 0,
};

const issue = (id: string, cycleId: string, category: Issue['status']['category']) =>
   ({ id, cycleId, status: { category } }) as Issue;

test('cycle progress is derived from issues assigned to that cycle', () => {
   const result = withCycleProgress(cycle, [
      issue('todo', cycle.id, 'unstarted'),
      issue('doing', cycle.id, 'started'),
      issue('done', cycle.id, 'completed'),
      issue('other-cycle', 'cycle-2', 'completed'),
   ]);

   expect(result.scope).toBe(3);
   expect(result.started).toBe(1);
   expect(result.completed).toBe(1);
   expect(result.successRate).toBe(33);
});
