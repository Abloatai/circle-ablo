'use client';

import { Button } from '@/components/ui/button';
import {
   Bot,
   ChevronRight,
   FileText,
   Lock,
   Radar,
   RefreshCcw,
   Repeat,
   Settings,
   Sparkles,
   Tag,
   Target,
   Users,
   Workflow,
   Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { LeaveTeamDialog } from './leave-dialogs';
import { DeleteTeamDialog, RetireTeamDialog } from './team-danger-dialogs';
import {
   useCycles,
   useIssues,
   useLabels,
   useProjects,
   useTeamStatuses,
   useTeamDocuments,
   useRouteTeam,
} from '@/hooks/use-workspace-data';
import { SettingsCard, SettingsRow, SettingsSection } from './shared';

interface TeamSettingsProps {
   teamId: string;
}

/** Per-team settings page (general, workflow, AI and danger zone). */
export default function TeamSettings({ teamId }: TeamSettingsProps) {
   const team = useRouteTeam(teamId);
   const status = useTeamStatuses(team?.id);
   const { orgId } = useParams<{ orgId: string }>();
   const [leaving, setLeaving] = useState(false);
   const [retiring, setRetiring] = useState(false);
   const [deleting, setDeleting] = useState(false);
   // Counts read live from the synced pool, so the confirmation says what is
   // actually there rather than a number typed into a string.
   const allIssues = useIssues();
   const allCycles = useCycles();
   const allProjects = useProjects();
   const labels = useLabels();
   const folders = useTeamDocuments(team?.id ?? '');
   if (!team) {
      return (
         <div className="max-w-2xl mx-auto px-6 py-10">
            <h1 className="text-2xl font-medium">Team not found</h1>
         </div>
      );
   }

   const cycles = allCycles.filter((cycle) => cycle.teamId === team.id);

   return (
      <div className="w-full overflow-y-auto h-full">
         <div className="max-w-2xl mx-auto px-6 py-10 pb-20">
            <div className="flex items-center gap-3">
               <span className="inline-flex size-9 bg-muted/50 items-center justify-center rounded-md text-lg">
                  {team.icon}
               </span>
               <div className="flex-1">
                  <h1 className="text-2xl font-medium">{team.name}</h1>
                  <p className="text-sm text-muted-foreground">
                     Accessible to all workspace members
                  </p>
               </div>
               <Link
                  href={`/${orgId}/team/${team.id}/overview`}
                  className="text-sm inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
               >
                  Team overview
                  <ChevronRight className="size-4" />
               </Link>
            </div>

            <div className="flex flex-col gap-10 mt-10">
               <SettingsSection>
                  <SettingsCard>
                     <SettingsRow
                        icon={<Settings className="size-4" />}
                        title="General"
                        description="Name, identifier, timezone, estimates, and broader settings"
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Lock className="size-4" />}
                        title="Access and permissions"
                        description="Manage team access and who in the team can take certain actions"
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Users className="size-4" />}
                        title="Members"
                        description="Manage team members"
                        trailing={<span>{team.members.length} members</span>}
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Zap className="size-4" />}
                        title="Slack notifications"
                        description="Broadcast notifications to Slack"
                        trailing={<span>Off</span>}
                        chevron
                        disabled
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="Issues, projects, and docs">
                  <SettingsCard>
                     <SettingsRow
                        icon={<Tag className="size-4" />}
                        title="Issue labels"
                        description="Labels available to this team's issues"
                        trailing={<span>{labels.length} labels</span>}
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<FileText className="size-4" />}
                        title="Templates"
                        description="Pre-filled templates for issues, documents, and projects"
                        trailing={<span>None</span>}
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Repeat className="size-4" />}
                        title="Recurring issues"
                        description="Automatically create issues on a schedule"
                        trailing={<span>None</span>}
                        chevron
                        disabled
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="Workflow">
                  <SettingsCard>
                     <SettingsRow
                        icon={<Target className="size-4" />}
                        title="Issue statuses"
                        description="Customize the statuses issues go through"
                        trailing={<span>{status.length} statuses</span>}
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Workflow className="size-4" />}
                        title="Workflows & automations"
                        description="Manage issue automations, git workflows and other workflows"
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Radar className="size-4" />}
                        title="Triage"
                        description="Streamline how you handle requests from outside your team"
                        trailing={
                           <span>
                              {status.some((item) => item.category === 'triage')
                                 ? 'Enabled'
                                 : 'Off'}
                           </span>
                        }
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<RefreshCcw className="size-4" />}
                        title="Cycles"
                        description="Focus your team over short, time-boxed windows"
                        trailing={
                           <span>
                              {cycles.length > 0
                                 ? `${cycles.length} ${cycles.length === 1 ? 'cycle' : 'cycles'}`
                                 : 'Off'}
                           </span>
                        }
                        chevron
                        disabled
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection title="AI & Agents">
                  <SettingsCard>
                     <SettingsRow
                        icon={<Bot className="size-4" />}
                        title="Team agents"
                        description="Add guidance for how agents should operate within this team"
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Sparkles className="size-4" />}
                        title="Agent skills"
                        description="Agent skills shared with this team"
                        trailing={<span>None</span>}
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<RefreshCcw className="size-4" />}
                        title="Loops"
                        description="Automated agent workflows that run on a schedule or when an issue is updated"
                        trailing={<span>None</span>}
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<Zap className="size-4" />}
                        title="Project updates"
                        description="Automatically generate updates using recent activity and defined rules"
                        chevron
                        disabled
                     />
                     <SettingsRow
                        icon={<FileText className="size-4" />}
                        title="Resolved thread summaries"
                        description="Automatically generate summaries for resolved threads"
                        chevron
                        disabled
                     />
                  </SettingsCard>
               </SettingsSection>

               <SettingsSection
                  title="Team hierarchy"
                  description="Teams can be nested to reflect your team structure and to share workflows and settings."
               >
                  <div />
               </SettingsSection>

               <SettingsSection title="Danger zone">
                  <SettingsCard>
                     <SettingsRow
                        title="Leave team"
                        description="Remove yourself as a member of this team"
                        trailing={
                           <Button size="xs" variant="ghost" onClick={() => setLeaving(true)}>
                              Leave team...
                           </Button>
                        }
                     />
                     <SettingsRow
                        title={team.archived ? 'Bring team back' : 'Retire team'}
                        description={
                           team.archived
                              ? 'This team is retired. Bring it back to let it take new issues again.'
                              : 'Stop new issues being created in this team while keeping all its history'
                        }
                        trailing={
                           <Button size="xs" variant="ghost" onClick={() => setRetiring(true)}>
                              {team.archived ? 'Bring back...' : 'Retire...'}
                           </Button>
                        }
                     />
                     <SettingsRow
                        title="Delete team"
                        description="Permanently delete this team and everything in it. There is no undo."
                        trailing={
                           <Button
                              size="xs"
                              variant="ghost"
                              className="text-red-500 hover:text-red-500"
                              onClick={() => setDeleting(true)}
                           >
                              Delete...
                           </Button>
                        }
                     />
                  </SettingsCard>
               </SettingsSection>

               <LeaveTeamDialog
                  teamId={team.id}
                  teamName={team.name}
                  open={leaving}
                  onOpenChange={setLeaving}
               />
               <RetireTeamDialog
                  teamId={team.id}
                  teamName={team.name}
                  archived={Boolean(team.archived)}
                  open={retiring}
                  onOpenChange={setRetiring}
               />
               <DeleteTeamDialog
                  teamId={team.id}
                  teamName={team.name}
                  counts={{
                     issues: allIssues.filter((issue) => issue.teamId === team.id).length,
                     cycles: allCycles.filter((cycle) => cycle.teamId === team.id).length,
                     projects: allProjects.filter((project) => project.teamId === team.id).length,
                     documents: folders.reduce(
                        (total, folder) => total + folder.documents.length,
                        0
                     ),
                  }}
                  open={deleting}
                  onOpenChange={setDeleting}
               />
            </div>
         </div>
      </div>
   );
}
