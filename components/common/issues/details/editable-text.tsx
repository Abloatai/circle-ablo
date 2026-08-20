'use client';

import { useEffect, useRef, useState } from 'react';
import type { ContentBlock } from '@/lib/domain/issue-details';
import { blocksToMarkdown, markdownToBlocks } from '@/lib/data/content-blocks';
import { useIssueActions } from '@/hooks/use-issue-actions';
import { ContentBlocks } from './content-blocks';
import { cn } from '@/lib/utils';

/**
 * The issue title, edited in place.
 *
 * It saves on blur rather than behind a Save button — the title is one line
 * and an explicit button for it is friction — but only when the text actually
 * changed, so clicking through the page does not write.
 */
export function EditableTitle({ issueId, title }: { issueId: string; title: string }) {
   const { setTitle } = useIssueActions();
   const [draft, setDraft] = useState(title);
   const ref = useRef<HTMLTextAreaElement>(null);

   // Someone else may rename it while this is open; their version wins unless
   // this tab has unsaved edits.
   useEffect(() => setDraft(title), [title]);

   // Grow to fit rather than scrolling: a title is short but often wraps.
   useEffect(() => {
      const node = ref.current;
      if (!node) return;
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
   }, [draft]);

   function commit() {
      const next = draft.trim();
      if (!next || next === title) {
         setDraft(title);
         return;
      }
      void setTitle(issueId, next);
   }

   return (
      <textarea
         ref={ref}
         rows={1}
         value={draft}
         aria-label="Issue title"
         onChange={(event) => setDraft(event.target.value)}
         onBlur={commit}
         onKeyDown={(event) => {
            if (event.key === 'Enter') {
               event.preventDefault();
               event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
               setDraft(title);
               event.currentTarget.blur();
            }
         }}
         className="w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight text-balance outline-none focus:bg-muted/30 rounded-sm -mx-1 px-1"
      />
   );
}

/**
 * The description: rendered blocks until you click it, Markdown while you edit.
 *
 * Storage is block JSON, so the editor converts both ways — see
 * `lib/data/content-blocks.ts`, which round-trips every block type the
 * renderer knows, including the image and video blocks Markdown cannot spell.
 *
 * This one does have explicit Save and Cancel: a description is long enough
 * that losing it to a stray click off the textarea would be worse than a
 * button.
 */
export function EditableDescription({
   issueId,
   blocks,
}: {
   issueId: string;
   blocks: ContentBlock[];
}) {
   const { setDescription } = useIssueActions();
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState('');
   const [saving, setSaving] = useState(false);

   function open() {
      setDraft(blocksToMarkdown(blocks));
      setEditing(true);
   }

   async function save() {
      setSaving(true);
      await setDescription(issueId, JSON.stringify(markdownToBlocks(draft)));
      setSaving(false);
      setEditing(false);
   }

   if (!editing) {
      return (
         <div
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(event) => {
               if (event.key === 'Enter') open();
            }}
            className={cn(
               'rounded-sm -mx-2 px-2 py-1 cursor-text hover:bg-muted/30',
               blocks.length === 0 && 'text-muted-foreground'
            )}
         >
            {blocks.length > 0 ? (
               <ContentBlocks blocks={blocks} />
            ) : (
               <p className="text-sm">Add a description…</p>
            )}
         </div>
      );
   }

   return (
      <div className="space-y-2">
         <textarea
            autoFocus
            value={draft}
            aria-label="Issue description"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
               if (event.key === 'Escape') setEditing(false);
               if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save();
            }}
            className="w-full min-h-64 rounded-md border bg-background p-3 font-mono text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
         />
         <div className="flex items-center gap-2">
            <button
               onClick={() => void save()}
               disabled={saving}
               className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
               {saving ? 'Saving…' : 'Save'}
            </button>
            <button
               onClick={() => setEditing(false)}
               className="rounded-md border px-3 py-1.5 text-xs"
            >
               Cancel
            </button>
            <span className="text-xs text-muted-foreground">
               Markdown · ⌘↵ to save, Esc to cancel
            </span>
         </div>
      </div>
   );
}
