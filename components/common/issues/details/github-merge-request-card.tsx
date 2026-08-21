'use client';

import { useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, GitPullRequestArrow } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '@/components/providers/workspace-provider';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitHubMergeRequestPayload } from '@/lib/github/merge-request';

const statusDetails = {
   pending: {
      label: 'Pending approval',
      icon: Clock3,
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
   },
   merged: {
      label: 'Merged',
      icon: CheckCircle2,
      className: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
   },
   failed: {
      label: 'Failed',
      icon: CircleAlert,
      className: 'border-destructive/40 bg-destructive/10 text-destructive-foreground',
   },
} as const;

export function GitHubMergeRequestCard({
   activityId,
   actorName,
   timeAgo,
   payload,
}: {
   activityId: string;
   actorName: string;
   timeAgo: string;
   payload: GitHubMergeRequestPayload;
}) {
   const { membersById, viewerId } = useWorkspace();
   const [submitting, setSubmitting] = useState(false);
   const canApprove = membersById.get(viewerId)?.role === 'Admin';
   const status = statusDetails[payload.status];
   const StatusIcon = status.icon;
   const shortHead = payload.headSha.slice(0, 7);
   const shortMerged = payload.mergedSha?.slice(0, 7);

   async function approve() {
      setSubmitting(true);
      try {
         const response = await fetch('/api/github/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activityId }),
         });
         const body = (await response.json()) as { error?: string; sha?: string };
         if (!response.ok) throw new Error(body.error ?? 'GitHub did not merge the pull request');
         toast.success(`Merged ${payload.repository}#${payload.pullNumber}`, {
            description: body.sha ? `Commit ${body.sha.slice(0, 7)}` : undefined,
         });
      } catch (error) {
         toast.error('Could not merge the pull request', {
            description: error instanceof Error ? error.message : undefined,
         });
      } finally {
         setSubmitting(false);
      }
   }

   return (
      <div className="my-2 rounded-lg border border-border/60 bg-container p-3.5">
         <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-accent">
               <GitPullRequestArrow className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
               <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-medium">{actorName} requested a merge</p>
                  <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  <Badge variant="outline" className={`ml-auto px-2 py-0.5 ${status.className}`}>
                     <StatusIcon className="size-3" />
                     {status.label}
                  </Badge>
               </div>
               <a
                  href={payload.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-sm font-medium hover:underline"
               >
                  {payload.repository}#{payload.pullNumber} · {payload.title}
               </a>
               <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="capitalize">{payload.mergeMethod}</span>
                  <span>
                     Head <code className="font-mono text-foreground/80">{shortHead}</code>
                  </span>
                  {payload.status === 'merged' && shortMerged ? (
                     <span>
                        Result <code className="font-mono text-foreground/80">{shortMerged}</code>
                     </span>
                  ) : null}
               </div>

               {payload.status === 'failed' && payload.error ? (
                  <p className="mt-2 text-xs text-destructive-foreground">{payload.error}</p>
               ) : null}
               {payload.status === 'merged' ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                     Approved by {payload.approvedByName ?? 'a workspace admin'}
                  </p>
               ) : canApprove ? (
                  <div className="mt-3">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button size="xs" disabled={submitting}>
                              {payload.status === 'failed' ? 'Review retry' : 'Review merge'}
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                           <AlertDialogHeader>
                              <AlertDialogTitle>Approve and merge pull request?</AlertDialogTitle>
                              <AlertDialogDescription>
                                 This will {payload.mergeMethod}{' '}
                                 <span className="font-medium text-foreground">
                                    {payload.repository}#{payload.pullNumber}
                                 </span>{' '}
                                 at commit{' '}
                                 <code className="font-mono text-foreground">{shortHead}</code>. If
                                 the pull request changed, GitHub will reject the merge.
                              </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                 disabled={submitting}
                                 onClick={() => void approve()}
                              >
                                 {submitting ? 'Merging…' : 'Approve and merge'}
                              </AlertDialogAction>
                           </AlertDialogFooter>
                        </AlertDialogContent>
                     </AlertDialog>
                  </div>
               ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                     A workspace admin must approve this merge.
                  </p>
               )}
            </div>
         </div>
      </div>
   );
}
