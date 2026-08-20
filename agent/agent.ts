import { defineAgent } from 'eve';

export default defineAgent({
   /**
    * Routed through the Vercel AI Gateway. Carries tool-use, reasoning and
    * web search — the whole capability surface this agent needs.
    */
   model: 'openai/gpt-5.6-luna',
});
