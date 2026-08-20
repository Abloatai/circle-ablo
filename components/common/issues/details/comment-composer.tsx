'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useAblo } from '@/lib/ablo';
import { notify } from '@/lib/data/notify';

/**
 * Writes a comment on the issue.
 *
 * The body is stored as the same block JSON the description uses, so a comment
 * written here and one written by an agent are the same shape.
 */
export function CommentComposer({
   issueId,
   teamId,
   participants = [],
}: {
   issueId: string;
   teamId: string;
   /** Assignee and earlier commenters — everyone the reply concerns. */
   participants?: (string | null | undefined)[];
}) {
   const ablo = useAblo();
   const { membersById, viewerId, organizationId } = useWorkspace();
   const [body, setBody] = useState('');
   const [pending, setPending] = useState(false);
   const viewer = membersById.get(viewerId);

   async function submit() {
      const text = body.trim();
      if (!text || !ablo) return;
      setPending(true);
      try {
         await ablo.comment.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               teamId,
               issueId,
               authorId: viewerId,
               body: JSON.stringify([{ type: 'paragraph', text }]),
               reactions: {},
            },
         });
         setBody('');
         void notify({
            ablo,
            workspaceId: organizationId,
            actorId: viewerId,
            issueId,
            type: 'comment',
            recipients: participants,
         });
      } catch (error) {
         toast.error('Could not post the comment', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setPending(false);
      }
   }

   return (
      <div className="mt-6 flex gap-3">
         <Avatar className="size-7 shrink-0">
            <AvatarImage src={viewer?.avatarUrl} alt={viewer?.name ?? ''} />
            <AvatarFallback>{viewer?.name?.[0] ?? '?'}</AvatarFallback>
         </Avatar>
         <div className="flex-1 min-w-0 space-y-2">
            <Textarea
               value={body}
               onChange={(event) => setBody(event.target.value)}
               placeholder="Leave a comment…"
               className="min-h-20 resize-y"
               onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit();
               }}
            />
            <div className="flex justify-end">
               <Button size="sm" onClick={() => void submit()} disabled={pending || !body.trim()}>
                  {pending ? 'Posting…' : 'Comment'}
               </Button>
            </div>
         </div>
      </div>
   );
}
