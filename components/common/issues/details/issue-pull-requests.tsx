'use client';

import { useState } from 'react';
import { GitPullRequestArrow, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAblo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useIssuePullRequests, type IssuePullRequest } from '@/hooks/use-workspace-data';

const STATES: IssuePullRequest['state'][] = ['open', 'draft', 'merged', 'closed'];

const STATE_COLOR: Record<IssuePullRequest['state'], string> = {
   open: 'text-green-500',
   draft: 'text-muted-foreground',
   merged: 'text-purple-400',
   closed: 'text-red-500',
};

/** `owner/repo#123` from a GitHub-shaped URL; the URL itself otherwise. */
function titleFor(url: string): string {
   try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      return match ? `${match[1]}/${match[2]}#${match[3]}` : parsed.hostname + parsed.pathname;
   } catch {
      return url;
   }
}

/**
 * Pull requests attached to an issue.
 *
 * A row is a link someone pasted. If it is a GitHub pull request, the title and
 * state come from GitHub — asked for on attach and on demand after — so the
 * section reports what is true rather than what someone typed. If it is not, or
 * GitHub cannot be reached, the link stands with the state you set by hand.
 *
 * The section used to render invented PR numbers and statuses from
 * `getIssueDetail()`: a fixture inside a panel of real data, where nothing
 * distinguishes it from a fact.
 */
export function IssuePullRequests({ issueId, teamId }: { issueId: string; teamId: string }) {
   const pullRequests = useIssuePullRequests(issueId);
   const ablo = useAblo();
   const { organizationId } = useWorkspace();
   const [adding, setAdding] = useState(false);
   const [draft, setDraft] = useState('');

   /**
    * Attaches a link and asks GitHub what it actually is.
    *
    * The row is written first with what the URL alone can tell us, then patched
    * with the real title and state — so a slow or unreachable GitHub costs you
    * an accurate title, not the link itself. Anything that is not a GitHub pull
    * request simply stays as it was pasted.
    */
   async function attach(url: string) {
      if (!ablo) return;
      let created;
      try {
         created = await ablo.issuePullRequest.create({
            data: {
               id: crypto.randomUUID(),
               workspaceId: organizationId,
               teamId,
               issueId,
               url,
               title: titleFor(url),
               state: 'open',
            },
         });
      } catch (error) {
         toast.error('Could not attach the pull request', {
            description: error instanceof Error ? error.message : undefined,
         });
         return;
      }
      await resolve(created.id, url);
   }

   /** Asks the server what GitHub says, and writes it if it says anything. */
   async function resolve(id: string, url: string) {
      if (!ablo) return;
      try {
         const response = await fetch('/api/pull-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
         });
         const body = (await response.json()) as {
            resolved?: boolean;
            title?: string;
            state?: IssuePullRequest['state'];
         };
         if (!body.resolved || !body.title || !body.state) return;
         await ablo.issuePullRequest.update({
            id,
            data: { title: body.title, state: body.state },
         });
      } catch {
         // An unresolvable link is still a link; leave what the person pasted.
      }
   }

   async function setState(id: string, state: IssuePullRequest['state']) {
      if (!ablo) return;
      try {
         await ablo.issuePullRequest.update({ id, data: { state } });
      } catch (error) {
         toast.error('Could not update the pull request', {
            description: error instanceof Error ? error.message : undefined,
         });
      }
   }

   async function detach(id: string) {
      if (!ablo) return;
      try {
         await ablo.issuePullRequest.delete({ id });
      } catch (error) {
         toast.error('Could not remove the pull request', {
            description: error instanceof Error ? error.message : undefined,
         });
      }
   }

   return (
      <div className="flex flex-col gap-1">
         {pullRequests.map((pr) => (
            <div key={pr.id} className="group flex items-center gap-2 text-sm min-w-0">
               <GitPullRequestArrow className={`size-3.5 shrink-0 ${STATE_COLOR[pr.state]}`} />
               <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:underline"
                  title={pr.url}
               >
                  {pr.title}
               </a>
               <DropdownMenu>
                  <DropdownMenuTrigger
                     aria-label={`State of ${pr.title}`}
                     className="ml-auto shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent text-muted-foreground outline-none"
                  >
                     {pr.state}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     {STATES.map((state) => (
                        <DropdownMenuItem key={state} onClick={() => void setState(pr.id, state)}>
                           <GitPullRequestArrow className={`size-3.5 ${STATE_COLOR[state]}`} />
                           <span className="capitalize">{state}</span>
                        </DropdownMenuItem>
                     ))}
                  </DropdownMenuContent>
               </DropdownMenu>
               <button
                  aria-label={`Refresh ${pr.title}`}
                  title="Ask GitHub for the current title and state"
                  onClick={() => void resolve(pr.id, pr.url)}
                  className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
               >
                  <RefreshCw className="size-3" />
               </button>
               <button
                  aria-label={`Remove ${pr.title}`}
                  onClick={() => void detach(pr.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
               >
                  <X className="size-3" />
               </button>
            </div>
         ))}

         {adding ? (
            <input
               autoFocus
               aria-label="Pull request URL"
               value={draft}
               placeholder="https://github.com/…/pull/123"
               onChange={(event) => setDraft(event.target.value)}
               onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                     setDraft('');
                     setAdding(false);
                  }
               }}
               onBlur={async () => {
                  const url = draft.trim();
                  setDraft('');
                  setAdding(false);
                  if (url) await attach(url);
               }}
               className="text-xs bg-transparent outline-none rounded-md border px-2 py-1"
            />
         ) : (
            <button
               onClick={() => setAdding(true)}
               className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
               <Plus className="size-3.5" />
               Attach pull request
            </button>
         )}
      </div>
   );
}
