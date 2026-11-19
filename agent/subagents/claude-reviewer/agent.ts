import { defineAgent } from 'eve';

export default defineAgent({
   description:
      'Claude code-review specialist. Independently inspects an authorized pull request or challenges GPT’s findings with file-and-line evidence.',
   model: 'anthropic/claude-sonnet-4.6',
   // Called through agent/tools/ask_claude_reviewer.ts, which requests the structured report.
   tool: false,
});
