import { LucideIcon, Box, Search, Workflow } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                      Agent page copy — prompts and skills                  */
/* -------------------------------------------------------------------------- */
/*
 * What is left here is presentation: the example prompts on the empty page and
 * the names in the skills menu. The canned replies that used to live below
 * these are gone — the page talks to the real agent now, so a fixture that
 * answers questions is exactly the thing that must not be in reach.
 */

export interface AgentExample {
   id: string;
   icon: LucideIcon;
   title: string;
   description: string;
   prompt: string;
}

export const agentExamples: AgentExample[] = [
   {
      id: 'create-project',
      icon: Box,
      title: 'Create a new project',
      description: 'Turn an idea into a well-scoped project',
      prompt: 'Create a project to ship a command palette for the docs site',
   },
   {
      id: 'research-topic',
      icon: Search,
      title: 'Research a topic',
      description: 'Research a topic across the issue backlog',
      prompt: 'What do we know about combobox accessibility issues?',
   },
   {
      id: 'automated-loop',
      icon: Workflow,
      title: 'Create automated loop',
      description: 'Learn what loops can do and create your first one',
      prompt: 'Help me set up a weekly triage loop for the Core team',
   },
];

export const agentSkills = ['Triage', 'Research', 'Project drafting', 'Weekly summary'];
