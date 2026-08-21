import { expect, test } from '@playwright/test';
import { statusesForTeam, type Status } from '@/lib/domain/status';

const makeStatus = (id: string, teamId?: string): Status =>
   ({
      id,
      teamId,
      name: id,
      category: 'unstarted',
      color: '#000000',
      icon: () => null,
   }) as Status;

test('team status choices include shared states and exclude other teams', () => {
   const shared = makeStatus('shared');
   const design = makeStatus('design', 'team-design');
   const core = makeStatus('core', 'team-core');

   expect(statusesForTeam([shared, design, core], 'team-core').map((status) => status.id)).toEqual([
      'shared',
      'core',
   ]);
   expect(statusesForTeam([shared, design, core], undefined).map((status) => status.id)).toEqual([
      'shared',
   ]);
});
