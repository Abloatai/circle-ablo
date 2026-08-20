'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';
import { blocksToMarkdown, markdownToBlocks } from '@/lib/data/content-blocks';
import { cn } from '@/lib/utils';
import type { ContentBlock } from '@/lib/domain/issue-details';
import type { Project } from '@/lib/domain/projects';
import { ContentBlocks } from '@/components/common/issues/details/content-blocks';

/** Block JSON, however it arrives. A plain string still renders, as one paragraph. */
export function parseBlocks(value: string | undefined): ContentBlock[] {
   if (!value) return [];
   try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as ContentBlock[];
   } catch {
      // not JSON — fall through
   }
   return [{ type: 'paragraph', text: value }];
}

function useProjectWrite() {
   const ablo = useAblo();
   return async (projectId: string, data: Record<string, unknown>, what: string) => {
      if (!ablo) return;
      try {
         await ablo.project.update({ id: projectId, data });
      } catch (error) {
         toast.error(`Could not update ${what}`, {
            description: error instanceof Error ? error.message : undefined,
         });
      }
   };
}

/**
 * The one-line summary under the project name, edited in place.
 *
 * It was `getProjectDetail(id).summary` — a fixture keyed by project id, which
 * meant a project created in the app got a generated summary belonging to
 * nobody. It is a column now.
 */
export function ProjectSummary({ project }: { project: Project }) {
   const write = useProjectWrite();
   const [draft, setDraft] = useState(project.summary ?? '');
   const ref = useRef<HTMLTextAreaElement>(null);

   useEffect(() => setDraft(project.summary ?? ''), [project.summary]);

   useEffect(() => {
      const node = ref.current;
      if (!node) return;
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
   }, [draft]);

   return (
      <textarea
         ref={ref}
         rows={1}
         value={draft}
         aria-label="Project summary"
         placeholder="What is this project for?"
         onChange={(event) => setDraft(event.target.value)}
         onBlur={() => {
            const next = draft.trim();
            if (next === (project.summary ?? '').trim()) return;
            void write(project.id, { summary: next }, 'the summary');
         }}
         onKeyDown={(event) => {
            if (event.key === 'Enter') {
               event.preventDefault();
               event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
               setDraft(project.summary ?? '');
               event.currentTarget.blur();
            }
         }}
         className="mt-3 w-full resize-none bg-transparent outline-none text-muted-foreground leading-relaxed rounded-sm -mx-1 px-1 hover:bg-accent/40 focus:bg-accent/40 transition-colors"
      />
   );
}

/**
 * The project brief.
 *
 * Rendered as blocks, edited as Markdown — the same matched pair the issue
 * description uses, so a brief written here and one seeded from the fixture are
 * the same shape and survive a round trip.
 */
export function ProjectDescription({
   project,
   blocks,
}: {
   project: Project;
   blocks: ContentBlock[];
}) {
   const write = useProjectWrite();
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState('');

   if (!editing) {
      return (
         <div
            role="button"
            tabIndex={0}
            aria-label="Edit project description"
            onClick={() => {
               setDraft(blocksToMarkdown(blocks));
               setEditing(true);
            }}
            onKeyDown={(event) => {
               if (event.key === 'Enter') {
                  setDraft(blocksToMarkdown(blocks));
                  setEditing(true);
               }
            }}
            className={cn(
               'rounded-md -mx-2 px-2 py-1 hover:bg-accent/30 transition-colors cursor-text',
               blocks.length === 0 && 'text-muted-foreground'
            )}
         >
            {blocks.length === 0 ? 'Add a project brief…' : <ContentBlocks blocks={blocks} />}
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-2">
         <textarea
            autoFocus
            aria-label="Project description"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
               if (event.key === 'Escape') setEditing(false);
            }}
            className="w-full min-h-64 resize-y bg-transparent outline-none rounded-md border p-3 text-sm font-mono"
         />
         <div className="flex justify-end gap-2">
            <button
               onClick={() => setEditing(false)}
               className="text-sm text-muted-foreground hover:text-foreground"
            >
               Cancel
            </button>
            <button
               onClick={async () => {
                  setEditing(false);
                  await write(
                     project.id,
                     { description: JSON.stringify(markdownToBlocks(draft)) },
                     'the description'
                  );
               }}
               className="text-sm font-medium"
            >
               Save
            </button>
         </div>
      </div>
   );
}
