'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ActivityItem } from '@/lib/domain/issue-details';
import {
   Ban,
   CircleDot,
   GitPullRequestArrow,
   Link2,
   PenLine,
   RefreshCcw,
   SmilePlus,
   Pencil,
   Tag,
   Trash2,
   Unlock,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import dynamic from 'next/dynamic';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** The short list a person actually reaches for. */
const REACTIONS = ['👍', '🎉', '👀', '🚀', '❤️', '😄'];
import { ContentBlocks } from './content-blocks';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useCommentActions } from '@/hooks/use-comment-actions';
import { blocksToMarkdown, markdownToBlocks } from '@/lib/data/content-blocks';
import {
   GITHUB_MERGE_REQUEST_KIND,
   parseGitHubMergeRequestPayload,
} from '@/lib/github/merge-request';
import { GitHubMergeRequestCard } from './github-merge-request-card';

// Streamdown carries the full Markdown parser and is only needed for agent
// comments. Keep it out of the initial issue-detail bundle when a discussion
// contains only people.
const AgentComment = dynamic(() => import('./agent-comment').then((module) => module.AgentComment));

const EVENT_ICONS: Record<string, ReactNode> = {
   created: <PenLine className="size-3.5" />,
   status: <CircleDot className="size-3.5" />,
   label: <Tag className="size-3.5" />,
   priority: <CircleDot className="size-3.5" />,
   cycle: <RefreshCcw className="size-3.5" />,
   blocked: <Ban className="size-3.5" />,
   unblocked: <Unlock className="size-3.5" />,
   related: <Link2 className="size-3.5" />,
   pr: <GitPullRequestArrow className="size-3.5" />,
};

function EventRow({ item }: { item: Extract<ActivityItem, { kind: 'event' }> }) {
   if (item.event === GITHUB_MERGE_REQUEST_KIND) {
      const payload = parseGitHubMergeRequestPayload(item.payload);
      if (payload) {
         return (
            <GitHubMergeRequestCard
               activityId={item.id}
               actorName={item.actor.name}
               timeAgo={item.timeAgo}
               payload={payload}
            />
         );
      }
   }

   return (
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-1.5">
         <span className="size-5 rounded-full bg-accent flex items-center justify-center shrink-0">
            {EVENT_ICONS[item.event] ?? <CircleDot className="size-3.5" />}
         </span>
         <span className="min-w-0 truncate">
            <span className="text-foreground/90 font-medium">{item.actor.name}</span> {item.text}
         </span>
         <span className="shrink-0 text-xs">· {item.timeAgo}</span>
      </div>
   );
}

/**
 * One comment.
 *
 * Editing and deleting are offered only on your own — the capability allows any
 * comment in the workspace, so the restraint is here, where the viewer is
 * known. The body round-trips through Markdown, the same matched pair the issue
 * description uses, so an edit cannot silently drop a block it could not spell.
 */
function CommentCard({ item }: { item: Extract<ActivityItem, { kind: 'comment' }> }) {
   const { viewerId } = useWorkspace();
   const { setBody, remove, toggleReaction } = useCommentActions();
   const react = (emoji: string) =>
      toggleReaction(item.id, emoji, item.reactionsBy ?? {}, viewerId);
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState('');
   const mine = item.actor.id === viewerId;

   return (
      <div className="group my-2 rounded-lg border border-border/60 bg-container p-3.5">
         <div className="flex items-center gap-2 mb-1.5">
            <Avatar className="size-5">
               <AvatarImage src={item.actor.avatarUrl} alt={item.actor.name} />
               <AvatarFallback>{item.actor.name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{item.actor.name}</span>
            <span className="text-xs text-muted-foreground">{item.timeAgo}</span>
            {mine && !editing && (
               <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                     aria-label="Edit comment"
                     onClick={() => {
                        setDraft(blocksToMarkdown(item.body));
                        setEditing(true);
                     }}
                     className="text-muted-foreground hover:text-foreground"
                  >
                     <Pencil className="size-3.5" />
                  </button>
                  <button
                     aria-label="Delete comment"
                     onClick={() => void remove(item.id)}
                     className="text-muted-foreground hover:text-destructive"
                  >
                     <Trash2 className="size-3.5" />
                  </button>
               </span>
            )}
         </div>
         {editing ? (
            <div className="flex flex-col gap-2">
               <textarea
                  autoFocus
                  aria-label="Edit comment body"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                     if (event.key === 'Escape') setEditing(false);
                  }}
                  className="w-full min-h-24 resize-y bg-transparent outline-none rounded-md border p-2 text-sm"
               />
               <div className="flex justify-end gap-2 text-sm">
                  <button
                     onClick={() => setEditing(false)}
                     className="text-muted-foreground hover:text-foreground"
                  >
                     Cancel
                  </button>
                  <button
                     className="font-medium"
                     onClick={async () => {
                        const next = draft.trim();
                        if (!next) return;
                        if (await setBody(item.id, JSON.stringify(markdownToBlocks(next)))) {
                           setEditing(false);
                        }
                     }}
                  >
                     Save
                  </button>
               </div>
            </div>
         ) : (
            <div className="text-sm [&_p]:my-1.5">
               {item.actor.role === 'Application' ? (
                  <AgentComment blocks={item.body} />
               ) : (
                  <ContentBlocks blocks={item.body} />
               )}
            </div>
         )}
         <div className="flex items-center gap-1.5 mt-1">
            {item.reactions?.map((reaction) => (
               <button
                  key={reaction.emoji}
                  aria-label={`${reaction.mine ? 'Remove' : 'Add'} ${reaction.emoji} reaction`}
                  onClick={() => void react(reaction.emoji)}
                  className={cn(
                     'inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 transition-colors',
                     // Your own reaction is marked, because a bare count cannot
                     // tell you whether clicking adds or removes.
                     reaction.mine
                        ? 'bg-primary/10 border-primary/40 text-foreground'
                        : 'bg-accent/60 border-border/60 hover:bg-accent'
                  )}
               >
                  {reaction.emoji} {reaction.count}
               </button>
            ))}
            <DropdownMenu>
               <DropdownMenuTrigger
                  aria-label="Add reaction"
                  className="text-muted-foreground hover:text-foreground outline-none"
               >
                  <SmilePlus className="size-3.5" />
               </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="flex gap-1 p-1 w-auto min-w-0">
                  {REACTIONS.map((emoji) => (
                     <button
                        key={emoji}
                        aria-label={`React with ${emoji}`}
                        onClick={() => void react(emoji)}
                        className="text-base leading-none rounded px-1.5 py-1 hover:bg-accent"
                     >
                        {emoji}
                     </button>
                  ))}
               </DropdownMenuContent>
            </DropdownMenu>
         </div>
      </div>
   );
}

/**
 * Issue activity: events and comments, interleaved, straight from the synced
 * pool.
 *
 * It renders the `activity` prop and holds none of it. It used to copy the prop
 * into `useState` on mount and render that copy for the rest of the page's
 * life, so the feed showed whatever had synced by the time it mounted and
 * nothing after — not a teammate's comment, not the agent's, not the one you
 * had just written yourself. It also carried its own composer that pushed a
 * `local-*` comment into that array and persisted nothing, which is what made
 * the staleness hard to notice: the feed did move when you typed in it.
 *
 * The real composer is `CommentComposer`, rendered underneath this by
 * `issue-details.tsx`, and it writes through Ablo.
 */
export function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
   return (
      <div className="mt-10">
         <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">Activity</h2>
            <button className="text-xs text-muted-foreground hover:text-foreground">
               Subscribe
            </button>
         </div>

         <div className="flex flex-col">
            {activity.map((item) =>
               item.kind === 'event' ? (
                  <EventRow key={item.id} item={item} />
               ) : (
                  <CommentCard key={item.id} item={item} />
               )
            )}
         </div>
      </div>
   );
}
