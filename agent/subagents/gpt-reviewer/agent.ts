import { defineAgent } from 'eve';

export default defineAgent({
   description:
      'GPT code-review specialist. Independently inspects an authorized pull request or challenges Claude’s findings with file-and-line evidence.',
   model: 'openai/gpt-5.6-terra',
   // Called through agent/tools/ask_gpt_reviewer.ts, which requests the structured report.
   tool: false,
});
