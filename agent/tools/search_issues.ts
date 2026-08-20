import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { listAll, listAllWhere, loadRun } from '../lib/circle';

export default defineTool({
   description:
      'Read the issues of the team this run belongs to. Answers questions about the workspace: how many there are, what is in a given status, what matches a word. Works whether or not the run has an issue attached, so it is how you answer in a conversation. The team is fixed by the run — you cannot search another one, and you should not pass a team name or key as the query, which would filter the issues down to the few that happen to mention it.',
   inputSchema: z.object({
      runId: z.string().describe('The run id from the message you were sent.'),
      query: z
         .string()
         .optional()
         .describe(
            'Optional. Matches the title or identifier, case-insensitive. Omit it to get every issue on the team — which is what a "how many" question wants. Never pass the team name or key here.'
         ),
      status: z.string().optional().describe('A status name, as returned in statuses below.'),
      limit: z.number().optional().describe('How many issues to return. Default 20, max 100.'),
   }),
   async execute({ runId, query, status, limit }) {
      const context = await loadRun(runId);

      const states = await listAll((page) => context.ablo.workflowState.list(page));
      const statusById = new Map(states.map((state) => [state.id, state.name]));

      // Narrowed here rather than by the server: a `where` on a reference field
      // silently matches nothing. See `listAllWhere`.
      const wantedStatus = status?.trim().toLowerCase();
      const wantedText = query?.trim().toLowerCase();

      const issues = await listAllWhere(
         (page) => context.ablo.issue.list(page),
         (issue) => {
            if (issue.teamId !== context.teamId) return false;
            if (wantedStatus && statusById.get(issue.statusId)?.toLowerCase() !== wantedStatus) {
               return false;
            }
            if (!wantedText) return true;
            return (
               issue.title.toLowerCase().includes(wantedText) ||
               issue.identifier.toLowerCase().includes(wantedText)
            );
         }
      );

      const capped = Math.min(Math.max(limit ?? 20, 1), 100);

      return {
         // Named, so an answer can say which team it is talking about instead
         // of assuming the one in the question is the one it read.
         team: context.teamId,
         // The total is what a question like "how many" is actually asking, and
         // it is not the same as the number of rows returned below.
         matched: issues.length,
         returned: Math.min(issues.length, capped),
         statuses: states.map((state) => state.name),
         issues: issues.slice(0, capped).map((issue) => ({
            identifier: issue.identifier,
            title: issue.title,
            status: statusById.get(issue.statusId) ?? issue.statusId,
            assigneeId: issue.assigneeId ?? null,
         })),
      };
   },
});
