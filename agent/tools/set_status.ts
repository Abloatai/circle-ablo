import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { context as abloContext } from '@abloatai/ablo/context';
import { listAll, loadRun, idempotencyKey } from '../lib/circle';

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

      // `context()` keeps the evidence behind this read. The rows it returns
      // ride along on the write below as its premise, so if a status is renamed
      // or removed between the model choosing one and the write landing, the
      // write is rejected rather than pointing at something that moved.
      const read = await abloContext({
         ablo: context.ablo,
         data: { states: listAll((page) => context.ablo.workflowState.list(page)) },
      });
      const states = read.data.states;
      const target = states.find(
         (state) => state.name.toLowerCase() === status.trim().toLowerCase()
      );
      if (!target) {
         return { error: `No status named "${status}".`, available: states.map((s) => s.name) };
      }

      // Claim before writing: a person may be editing this issue right now. The
      // claim waits for them, hands back the current row, and rejects the write
      // if it changed underneath us.
      //
      // Narrowed to `statusId` rather than the whole row, because claims
      // conflict only where they intersect — someone retitling this issue while
      // the agent moves its status is not a conflict, and a whole-row claim
      // would have made them queue behind each other for no reason.
      await using claim = await context.ablo.issue.claim({
         id: context.issueId,
         fields: (issue) => issue.statusId,
         description: `moving to ${target.name}`,
      });

      await context.ablo.issue.update({
         id: claim.data.id,
         idempotencyKey: idempotencyKey(runId, 'set-status', target.id),
         data: { statusId: target.id },
         claim,
         reads: read.reads,
      });

      await context.ablo.issueActivity.create({
         // A retried tool call would otherwise add a second "changed status to
         // X" line to the feed for one change.
         idempotencyKey: idempotencyKey(runId, 'status', target.id),
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
