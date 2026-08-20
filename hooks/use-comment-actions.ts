'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAblo } from '@/lib/ablo';

/**
 * Edits and deletes a comment.
 *
 * The body is block JSON, the same shape the description and the agent's
 * comments use, so editing goes through the same round trip: blocks out to
 * Markdown, Markdown back to blocks.
 *
 * Nothing here checks who wrote it — the caller does, because "can I edit this"
 * is a question about the person looking at it, not about the write.
 */
export function useCommentActions() {
   const ablo = useAblo();

   return useMemo(
      () => ({
         setBody: async (id: string, body: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.comment.update({ id, data: { body } });
               return true;
            } catch (error) {
               toast.error('Could not save the comment', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },

         /**
          * Adds or removes your reaction.
          *
          * `reactions` is `{ emoji: [userId, …] }` rather than a count, which
          * is what lets this be a toggle — a counter alone could not tell
          * whether you had already reacted, so it could only ever go up. The
          * whole object is rewritten because it is one json column; an emoji
          * nobody reacts to any more is dropped rather than left at zero.
          */
         toggleReaction: async (
            id: string,
            emoji: string,
            current: Record<string, string[]>,
            viewerId: string
         ): Promise<boolean> => {
            if (!ablo) return false;
            const who = current[emoji] ?? [];
            const next = { ...current };
            if (who.includes(viewerId)) {
               const remaining = who.filter((entry) => entry !== viewerId);
               if (remaining.length) next[emoji] = remaining;
               else delete next[emoji];
            } else {
               next[emoji] = [...who, viewerId];
            }
            try {
               await ablo.comment.update({ id, data: { reactions: next } });
               return true;
            } catch (error) {
               toast.error('Could not react', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },

         remove: async (id: string): Promise<boolean> => {
            if (!ablo) return false;
            try {
               await ablo.comment.delete({ id });
               toast.success('Comment deleted');
               return true;
            } catch (error) {
               toast.error('Could not delete the comment', {
                  description: error instanceof Error ? error.message : undefined,
               });
               return false;
            }
         },
      }),
      [ablo]
   );
}
