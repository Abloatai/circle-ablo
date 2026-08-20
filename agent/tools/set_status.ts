import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { listAll, loadRun } from '../lib/circle';

export default defineTool({
   description:
      'Move the issue to another status, by name (for example "In Progress" or "Done"). Only use a status returned by get_assignment.',
   inputSchema: z.object({
      runId: z.string(),
      status: z.string().describe('The status name.'),
   }),
   async execute({ runId, status }) {
      const context = await loadRun(runId);
      if (!context.issueId) return { error: 'This run has no issue attached.' };

      const states = await listAll((page) => context.ablo.workflowState.list(page));
      const target = states.find(
         (state) => state.name.toLowerCase() === status.trim().toLowerCase()
      );
      if (!target) {
         return { error: `No status named "${status}".`, available: states.map((s) => s.name) };
      }

      // Claim before writing: a person may be editing this issue right now. The
      // claim waits for them, hands back the current row, and rejects the write
      // if it changed underneath us.
      await using claim = await context.ablo.issue.claim({
         id: context.issueId,
         description: `moving to ${target.name}`,
      });

      await context.ablo.issue.update({ id: claim.data.id, data: { statusId: target.id } });

      await context.ablo.issueActivity.create({
         data: {
            id: crypto.randomUUID(),
            workspaceId: context.organizationId,
            teamId: context.teamId,
            issueId: context.issueId,
            actorId: context.agentUserId,
            type: 'status',
            payload: { text: `changed status to ${target.name}` },
         },
      });

      return { status: target.name };
   },
});
