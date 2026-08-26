import { defineAgent } from 'eve';
import { reviewReportSchema } from '../../lib/review-schema';

export default defineAgent({
   description:
      'Claude code-review specialist. Independently inspects an authorized pull request or challenges GPT’s findings with file-and-line evidence.',
   model: 'anthropic/claude-sonnet-4.6',
   outputSchema: reviewReportSchema,
});
