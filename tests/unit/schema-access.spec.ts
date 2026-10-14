import { expect, test } from '@playwright/test';
import { toSchemaJSON, auditSchemaAccessPolicies } from '@abloatai/ablo/schema';
import { schema } from '@/ablo/schema';

test('released SDK serialization preserves all Circle access subjects', () => {
   const json = toSchemaJSON(schema);
   expect(Object.keys(json.models)).toHaveLength(25);
   expect(auditSchemaAccessPolicies(json)).toEqual([]);
   for (const model of Object.values(json.models)) {
      expect(model.subject?.field).toBeTruthy();
      expect(model.subject?.group).toBeTruthy();
   }
   expect(json.models.issue.subject).toEqual({ field: 'teamId', group: 'team' });
   expect(json.models.notification.subject).toEqual({ field: 'userId', group: 'user' });
});
