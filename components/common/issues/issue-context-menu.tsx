'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
   ContextMenuContent,
   ContextMenuGroup,
   ContextMenuLabel,
   ContextMenuItem,
   ContextMenuSeparator,
   ContextMenuShortcut,
   ContextMenuSub,
   ContextMenuSubContent,
   ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import {
   CircleCheck,
   User,
   BarChart3,
   Tag,
   Folder,
   CalendarClock,
   Pencil,
   Link as LinkIcon,
   Repeat2,
   Copy as CopyIcon,
   PlusSquare,
   Flag,
   ArrowRightLeft,
   Bell,
   Star,
   AlarmClock,
   Trash2,
   CheckCircle2,
   Clock,
   FileText,
   MessageSquare,
   Clipboard,
} from 'lucide-react';
import React, { useState } from 'react';
import { useIssues } from '@/hooks/use-workspace-data';
import { useIssueActions } from '@/hooks/use-issue-actions';
import { useStatuses } from '@/hooks/use-workspace-data';
import { priorities } from '@/lib/domain/priorities';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useLabels } from '@/hooks/use-workspace-data';
import { useProjects } from '@/hooks/use-workspace-data';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DeleteIssueDialog } from './delete-issue-dialog';
import { RenameIssueDialog } from './rename-issue-dialog';
import { unavailableItemClass } from '@/components/common/unavailable';
import { useFavoriteActions, useIsFavorite } from '@/hooks/use-favorite-actions';
import { useIsSubscribed, useSubscriptionActions } from '@/hooks/use-subscription-actions';

interface IssueContextMenuProps {
   issueId?: string;
}

export function IssueContextMenu({ issueId }: IssueContextMenuProps) {
   const { members: users } = useWorkspace();
   const status = useStatuses();
   const labels = useLabels();
   const projects = useProjects();
   // Both of these are rows, not component state. The old `useState(false)`
   // reset on every right-click and persisted nothing.
   const isSubscribed = Boolean(useIsSubscribed('issue', issueId));
   const { toggle: toggleSubscription } = useSubscriptionActions();
   // Starred state is a row, not component state — so it is already true when
   // the menu opens on an issue starred in another tab, and it survives a
   // reload. The old `useState(false)` reset on every right-click.
   const isFavorite = Boolean(useIsFavorite('issue', issueId));
   const { toggle: toggleFavorite } = useFavoriteActions();
   const [deleting, setDeleting] = useState(false);
   const [renaming, setRenaming] = useState(false);

   // These used to be Zustand actions over the fixtures, so every item in this
   // menu popped a success toast and changed nothing that survived a reload.
   const issues = useIssues();
   const getIssueById = (id: string) => issues.find((issue) => issue.id === id);
   const issue = issueId ? getIssueById(issueId) : undefined;
   const subIssueCount = issueId
      ? issues.filter((candidate) => candidate.parentIssueId === issueId).length
      : 0;
   const { setStatus, setPriority, setAssignee, setLabels, setProject, setDueDate } =
      useIssueActions();

   const handleStatusChange = (statusId: string) => {
      if (!issueId) return;
      const newStatus = status.find((s) => s.id === statusId);
      if (newStatus) {
         void setStatus(issueId, newStatus.id);
         toast.success(`Status updated to ${newStatus.name}`);
      }
   };

   const handlePriorityChange = (priorityId: string) => {
      if (!issueId) return;
      const newPriority = priorities.find((p) => p.id === priorityId);
      if (newPriority) {
         void setPriority(issueId, newPriority.id);
         toast.success(`Priority updated to ${newPriority.name}`);
      }
   };

   const handleAssigneeChange = (userId: string | null) => {
      if (!issueId) return;
      const newAssignee = userId ? users.find((u) => u.id === userId) || null : null;
      void setAssignee(issueId, newAssignee?.id ?? null);
      toast.success(newAssignee ? `Assigned to ${newAssignee.name}` : 'Unassigned');
   };

   const handleLabelToggle = (labelId: string) => {
      if (!issueId) return;
      const issue = getIssueById(issueId);
      const label = labels.find((l) => l.id === labelId);

      if (!issue || !label) return;

      const hasLabel = issue.labels.some((l) => l.id === labelId);

      const current = issue.labels.map((l) => l.id);
      if (hasLabel) {
         void setLabels(
            issueId,
            current.filter((id) => id !== labelId)
         );
         toast.success(`Removed label: ${label.name}`);
      } else {
         // A group is mutually exclusive: adding one of its labels replaces
         // whichever sibling was already there, the way setting a status does.
         const siblings = label.parentId
            ? new Set(
                 labels
                    .filter((other) => other.parentId === label.parentId && other.id !== labelId)
                    .map((other) => other.id)
              )
            : new Set<string>();
         const replaced = current.find((id) => siblings.has(id));
         const kept = current.filter((id) => !siblings.has(id));
         void setLabels(issueId, [...kept, labelId]);
         const replacedName = replaced
            ? labels.find((other) => other.id === replaced)?.name
            : undefined;
         toast.success(
            replacedName ? `${label.name} replaced ${replacedName}` : `Added label: ${label.name}`
         );
      }
   };

   const handleProjectChange = (projectId: string | null) => {
      if (!issueId) return;
      const newProject = projectId ? projects.find((p) => p.id === projectId) : undefined;
      void setProject(issueId, newProject?.id ?? null);
      toast.success(newProject ? `Project set to ${newProject.name}` : 'Project removed');
   };

   const handleSetDueDate = () => {
      if (!issueId) return;
      // The column is a date, so it stores yyyy-MM-dd rather than a timestamp.
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      void setDueDate(issueId, format(dueDate, 'yyyy-MM-dd'));
      toast.success('Due date set to 7 days from now');
   };

   const handleAddLink = () => {
      toast.success('Link added');
   };

   const handleMakeCopy = () => {
      toast.success('Issue copied');
   };

   const handleCreateRelated = () => {
      toast.success('Related issue created');
   };

   const handleMarkAs = (type: string) => {
      toast.success(`Marked as ${type}`);
   };

   const handleMove = () => {
      toast.success('Issue moved');
   };

   const handleSubscribe = () => {
      if (!issueId) return;
      void toggleSubscription('issue', issueId, issue?.identifier);
   };

   const handleFavorite = () => {
      if (!issueId) return;
      void toggleFavorite('issue', issueId, issue?.identifier);
   };

   const handleCopy = () => {
      if (!issueId) return;
      const issue = getIssueById(issueId);
      if (issue) {
         navigator.clipboard.writeText(issue.title);
         toast.success('Copied to clipboard');
      }
   };

   const handleRemindMe = () => {
      toast.success('Reminder set');
   };

   return (
      <ContextMenuContent className="w-64">
         <ContextMenuGroup>
            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <CircleCheck className="mr-2 size-4" /> Status
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-48">
                  {status
                     .filter((s) => !s.teamId || s.teamId === issue?.teamId)
                     .map((s) => {
                        const Icon = s.icon;
                        return (
                           <ContextMenuItem key={s.id} onClick={() => handleStatusChange(s.id)}>
                              <Icon /> {s.name}
                           </ContextMenuItem>
                        );
                     })}
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <User className="mr-2 size-4" /> Assignee
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-48">
                  <ContextMenuItem onClick={() => handleAssigneeChange(null)}>
                     <User className="size-4" /> Unassigned
                  </ContextMenuItem>
                  {users
                     .filter((user) => !issue?.teamId || user.teamIds.includes(issue.teamId))
                     .map((user) => (
                        <ContextMenuItem
                           key={user.id}
                           onClick={() => handleAssigneeChange(user.id)}
                        >
                           <Avatar className="size-4">
                              <AvatarImage src={user.avatarUrl} alt={user.name} />
                              <AvatarFallback>{user.name[0]}</AvatarFallback>
                           </Avatar>
                           {user.name}
                        </ContextMenuItem>
                     ))}
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <BarChart3 className="mr-2 size-4" /> Priority
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-48">
                  {priorities.map((priority) => (
                     <ContextMenuItem
                        key={priority.id}
                        onClick={() => handlePriorityChange(priority.id)}
                     >
                        <priority.icon className="size-4" /> {priority.name}
                     </ContextMenuItem>
                  ))}
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <Tag className="mr-2 size-4" /> Labels
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-48">
                  {/* Groups become headings; only real labels are selectable. */}
                  {labels
                     .filter((label) => label.isGroup)
                     .map((group) => {
                        const children = labels.filter((label) => label.parentId === group.id);
                        if (children.length === 0) return null;
                        return (
                           <ContextMenuGroup key={group.id}>
                              <ContextMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                 {group.name}
                              </ContextMenuLabel>
                              {children.map((label) => (
                                 <ContextMenuItem
                                    key={label.id}
                                    onClick={() => handleLabelToggle(label.id)}
                                 >
                                    <span
                                       className="inline-block size-3 rounded-full"
                                       style={{ backgroundColor: label.color }}
                                       aria-hidden="true"
                                    />
                                    {label.name}
                                 </ContextMenuItem>
                              ))}
                           </ContextMenuGroup>
                        );
                     })}
                  {labels
                     .filter((label) => !label.isGroup && !label.parentId)
                     .map((label) => (
                        <ContextMenuItem key={label.id} onClick={() => handleLabelToggle(label.id)}>
                           <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: label.color }}
                              aria-hidden="true"
                           />
                           {label.name}
                        </ContextMenuItem>
                     ))}
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <Folder className="mr-2 size-4" /> Project
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-64">
                  <ContextMenuItem onClick={() => handleProjectChange(null)}>
                     <Folder className="size-4" /> No Project
                  </ContextMenuItem>
                  {projects
                     .filter((project) => !issue || project.teamId === issue.teamId)
                     .slice(0, 5)
                     .map((project) => (
                        <ContextMenuItem
                           key={project.id}
                           onClick={() => handleProjectChange(project.id)}
                        >
                           <project.icon className="size-4" /> {project.name}
                        </ContextMenuItem>
                     ))}
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuItem onClick={handleSetDueDate}>
               <CalendarClock className="size-4" /> Set due date...
               <ContextMenuShortcut>D</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
               disabled={!issue}
               onSelect={(event) => {
                  // The menu closes on select and would unmount the dialog.
                  event.preventDefault();
                  setRenaming(true);
               }}
            >
               <Pencil className="size-4" /> Rename...
               <ContextMenuShortcut>R</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleAddLink}>
               <LinkIcon className="size-4" /> Add link...
               <ContextMenuShortcut>Ctrl L</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuSub>
               <ContextMenuSubTrigger>
                  <Repeat2 className="mr-2 size-4" /> Convert into
               </ContextMenuSubTrigger>
               <ContextMenuSubContent className="w-48">
                  {/* Converting an issue into a document or a comment on
                      another issue is a real migration of its content and
                      history. Neither is built. */}
                  <ContextMenuItem disabled className={unavailableItemClass}>
                     <FileText className="size-4" /> Document
                  </ContextMenuItem>
                  <ContextMenuItem disabled className={unavailableItemClass}>
                     <MessageSquare className="size-4" /> Comment
                  </ContextMenuItem>
               </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuItem onClick={handleMakeCopy}>
               <CopyIcon className="size-4" /> Make a copy...
            </ContextMenuItem>
         </ContextMenuGroup>

         <ContextMenuSeparator />

         <ContextMenuItem onClick={handleCreateRelated}>
            <PlusSquare className="size-4" /> Create related
         </ContextMenuItem>

         <ContextMenuSub>
            <ContextMenuSubTrigger>
               <Flag className="mr-2 size-4" /> Mark as
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
               <ContextMenuItem onClick={() => handleMarkAs('Completed')}>
                  <CheckCircle2 className="size-4" /> Completed
               </ContextMenuItem>
               <ContextMenuItem onClick={() => handleMarkAs('Duplicate')}>
                  <CopyIcon className="size-4" /> Duplicate
               </ContextMenuItem>
               <ContextMenuItem onClick={() => handleMarkAs("Won't Fix")}>
                  <Clock className="size-4" /> Won&apos;t Fix
               </ContextMenuItem>
            </ContextMenuSubContent>
         </ContextMenuSub>

         <ContextMenuItem onClick={handleMove}>
            <ArrowRightLeft className="size-4" /> Move
         </ContextMenuItem>

         <ContextMenuSeparator />

         <ContextMenuItem onClick={handleSubscribe}>
            <Bell className="size-4" /> {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
            <ContextMenuShortcut>S</ContextMenuShortcut>
         </ContextMenuItem>

         <ContextMenuItem onClick={handleFavorite}>
            <Star className="size-4" /> {isFavorite ? 'Unfavorite' : 'Favorite'}
            <ContextMenuShortcut>F</ContextMenuShortcut>
         </ContextMenuItem>

         <ContextMenuItem onClick={handleCopy}>
            <Clipboard className="size-4" /> Copy
         </ContextMenuItem>

         <ContextMenuItem onClick={handleRemindMe}>
            <AlarmClock className="size-4" /> Remind me
            <ContextMenuShortcut>H</ContextMenuShortcut>
         </ContextMenuItem>

         <ContextMenuSeparator />

         <ContextMenuItem
            variant="destructive"
            disabled={!issue}
            onSelect={(event) => {
               // The menu closes on select and would unmount the dialog with it.
               event.preventDefault();
               setDeleting(true);
            }}
         >
            <Trash2 className="size-4" /> Delete...
            <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
         </ContextMenuItem>

         {issue && <RenameIssueDialog issue={issue} open={renaming} onOpenChange={setRenaming} />}

         {issue && (
            <DeleteIssueDialog
               issue={issue}
               subIssueCount={subIssueCount}
               open={deleting}
               onOpenChange={setDeleting}
            />
         )}
      </ContextMenuContent>
   );
}
