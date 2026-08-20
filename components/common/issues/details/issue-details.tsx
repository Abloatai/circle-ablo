'use client';

import { getIssueDetail } from '@/lib/domain/issue-details';
import { useIssueDetail, useIssues } from '@/hooks/use-workspace-data';
import { Paperclip, Plus, SmilePlus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AssigneeUser } from '../assignee-user';
import { ActivityFeed } from './activity-feed';
import { CommentComposer } from './comment-composer';
import { EditableDescription, EditableTitle } from './editable-text';
import { IssuePropertiesPanel } from './issue-properties-panel';
import { DeleteIssueDialog } from '../delete-issue-dialog';
import { useIssueActions } from '@/hooks/use-issue-actions';
import { useCreateIssueStore } from '@/store/create-issue-store';

/**
 * Issue detail page: rich description, sub-issues, activity feed and a
 * properties sidebar — Linear-style.
 */
export default function IssueDetails() {
   const { orgId, issueId } = useParams<{ orgId: string; issueId: string }>();
   const { issue, description, activity } = useIssueDetail(issueId);
   const allIssues = useIssues();
   const { setParent } = useIssueActions();
   const { openModal } = useCreateIssueStore();
   const [deleting, setDeleting] = useState(false);

   // Issue links — blocked-by, related, PRs, milestone — are not modelled yet,
   // so the sidebar still reads them from the fixtures.
   const detail = useMemo(() => (issue ? getIssueDetail(issue) : null), [issue]);

   const subIssues = useMemo(
      () => (issue ? allIssues.filter((candidate) => candidate.parentIssueId === issue.id) : []),
      [allIssues, issue]
   );

   if (!issue || !detail) {
      return (
         <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-muted-foreground">
            <p>Issue {issueId} not found.</p>
            <Link href={`/${orgId}`} className="underline">
               Back to issues
            </Link>
         </div>
      );
   }

   return (
      <div className="w-full h-full flex overflow-hidden">
         {/* Main column */}
         <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-10">
               <EditableTitle issueId={issue.id} title={issue.title} />

               <div className="mt-6">
                  <EditableDescription issueId={issue.id} blocks={description} />
               </div>

               {/* Quick actions */}
               <div className="flex items-center gap-3 mt-6 text-muted-foreground">
                  <button className="hover:text-foreground" aria-label="Add reaction">
                     <SmilePlus className="size-4" />
                  </button>
                  <button className="hover:text-foreground" aria-label="Attach file">
                     <Paperclip className="size-4" />
                  </button>
                  <button
                     className="ml-auto hover:text-destructive"
                     aria-label="Delete issue"
                     title="Delete issue"
                     onClick={() => setDeleting(true)}
                  >
                     <Trash2 className="size-4" />
                  </button>
               </div>

               <DeleteIssueDialog
                  issue={issue}
                  subIssueCount={subIssues.length}
                  open={deleting}
                  onOpenChange={setDeleting}
                  // The page it is on is about to stop existing.
                  redirectTo={`/${orgId}`}
               />

               {/* Sub-issues */}
               <div className="mt-8">
                  {subIssues.length > 0 ? (
                     <>
                        <div className="flex items-center justify-between mb-1">
                           <h2 className="text-sm font-medium">
                              Sub-issues{' '}
                              <span className="text-muted-foreground">
                                 {
                                    subIssues.filter(
                                       (subIssue) => subIssue.status.category === 'completed'
                                    ).length
                                 }
                                 /{subIssues.length}
                              </span>
                           </h2>
                           <button
                              onClick={() => openModal(undefined, issue.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                           >
                              <Plus className="size-3.5" />
                              Add sub-issue
                           </button>
                        </div>
                        <div className="flex flex-col border-t border-border/50">
                           {subIssues.map((subIssue) => (
                              <Link
                                 key={subIssue.id}
                                 href={`/${orgId}/issue/${subIssue.identifier}`}
                                 className="flex items-center gap-2.5 h-10 px-1 border-b border-border/50 hover:bg-sidebar/50 text-sm min-w-0"
                              >
                                 <subIssue.status.icon />
                                 <span className="text-muted-foreground shrink-0 text-xs font-medium">
                                    {subIssue.identifier}
                                 </span>
                                 <span className="truncate font-medium">{subIssue.title}</span>
                                 <span className="ml-auto shrink-0">
                                    <AssigneeUser
                                       user={subIssue.assignee}
                                       issueId={subIssue.id}
                                       teamId={subIssue.teamId}
                                    />
                                 </span>
                                 <button
                                    aria-label={`Remove ${subIssue.identifier} from this issue`}
                                    title="Remove from this issue"
                                    className="shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={(event) => {
                                       // The row is a link; detaching is not navigation.
                                       event.preventDefault();
                                       event.stopPropagation();
                                       void setParent(subIssue.id, null);
                                    }}
                                 >
                                    <X className="size-3.5" />
                                 </button>
                              </Link>
                           ))}
                        </div>
                     </>
                  ) : (
                     <button
                        onClick={() => openModal(undefined, issue.id)}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                     >
                        <Plus className="size-4" />
                        Add sub-issues
                     </button>
                  )}
               </div>

               <div className="border-t border-border/60 mt-8" />

               <ActivityFeed activity={activity} />

               <CommentComposer
                  issueId={issue.id}
                  teamId={issue.teamId ?? ''}
                  participants={[
                     issue.assignee?.id,
                     issue.createdBy,
                     ...activity.map((item) => item.actor.id),
                  ]}
               />
            </div>
         </div>

         {/* Properties sidebar */}
         <aside className="hidden lg:block w-80 shrink-0 border-l h-full overflow-y-auto bg-container px-5 py-6">
            <IssuePropertiesPanel issue={issue} />
         </aside>
      </div>
   );
}
