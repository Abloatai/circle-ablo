import { defineAgent } from 'eve';
import { reviewReportSchema } from '../../lib/review-schema';

export default defineAgent({
   description:
      'GPT code-review specialist. Independently inspects an authorized pull request or challenges Claude’s findings with file-and-line evidence.',
   model: 'openai/gpt-5.6-terra',
   outputSchema: reviewReportSchema,
});
