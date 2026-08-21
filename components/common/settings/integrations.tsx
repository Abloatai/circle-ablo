'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Github, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SettingsCard, SettingsSection, SettingsShell } from './shared';

export interface GitHubInstallationView {
   id: string;
   installationId: number;
   accountLogin: string;
   repositorySelection: string;
   suspended: boolean;
   repositories: Array<{
      id: string;
      fullName: string;
      htmlUrl: string;
      private: boolean;
      enabled: boolean;
      teamId: string | null;
   }>;
}

interface IntegrationsProps {
   configured: boolean;
   canManage: boolean;
   result?: string;
   teams: Array<{ id: string; name: string }>;
   installations: GitHubInstallationView[];
}

const RESULT_MESSAGES: Record<string, { kind: 'success' | 'error'; message: string }> = {
   'connected': { kind: 'success', message: 'GitHub installation connected' },
   'cancelled': { kind: 'error', message: 'GitHub installation was cancelled' },
   'invalid-state': { kind: 'error', message: 'The GitHub connection expired. Please try again.' },
   'invalid_installation': { kind: 'error', message: 'GitHub did not return a valid installation' },
   'failed': { kind: 'error', message: 'Could not connect the GitHub installation' },
   'forbidden': { kind: 'error', message: 'Workspace admin access is required' },
};

async function responseError(response: Response): Promise<string> {
   try {
      return ((await response.json()) as { error?: string }).error ?? 'Request failed';
   } catch {
      return 'Request failed';
   }
}

export default function Integrations({
   configured,
   canManage,
   result,
   teams,
   installations,
}: IntegrationsProps) {
   const router = useRouter();
   const [busy, setBusy] = useState<string | null>(null);
   const [disconnecting, setDisconnecting] = useState<GitHubInstallationView | null>(null);

   useEffect(() => {
      if (!result) return;
      const notice = RESULT_MESSAGES[result];
      if (!notice) return;
      if (notice.kind === 'success') toast.success(notice.message);
      else toast.error(notice.message);
      const url = new URL(window.location.href);
      url.searchParams.delete('github');
      window.history.replaceState(window.history.state, '', url);
   }, [result]);

   async function updateRepository(
      repositoryId: string,
      change: { teamId?: string | null; enabled?: boolean }
   ) {
      setBusy(repositoryId);
      const response = await fetch('/api/github/repositories', {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ repositoryId, ...change }),
      });
      setBusy(null);
      if (!response.ok) {
         toast.error(await responseError(response));
         return;
      }
      router.refresh();
   }

   async function syncRepositories() {
      setBusy('sync');
      const response = await fetch('/api/github/sync', { method: 'POST' });
      setBusy(null);
      if (!response.ok) {
         toast.error(await responseError(response));
         return;
      }
      const body = (await response.json()) as { repositories: number };
      toast.success(`Synced ${body.repositories} GitHub repositories`);
      router.refresh();
   }

   async function disconnect() {
      if (!disconnecting) return;
      setBusy(disconnecting.id);
      const response = await fetch('/api/github/disconnect', {
         method: 'DELETE',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ installationId: disconnecting.id }),
      });
      setBusy(null);
      setDisconnecting(null);
      if (!response.ok) {
         toast.error(await responseError(response));
         return;
      }
      toast.success('GitHub disconnected from this workspace');
      router.refresh();
   }

   return (
      <SettingsShell
         title="Integrations"
         description="Connect services that your workspace and agents can securely use."
      >
         <SettingsSection
            title="GitHub"
            description="Let Scout inspect pull requests, including private repositories, without exposing installation tokens to the model."
            action={
               configured && canManage ? (
                  <Button size="sm" onClick={() => window.location.assign('/api/github/install')}>
                     <Github />
                     {installations.length ? 'Add installation' : 'Connect GitHub'}
                  </Button>
               ) : undefined
            }
         >
            {!configured ? (
               <SettingsCard>
                  <div className="flex items-start gap-3 px-4 py-4">
                     <Github className="size-5 mt-0.5" />
                     <div>
                        <p className="text-sm font-medium">GitHub App credentials are missing</p>
                        <p className="text-xs text-muted-foreground mt-1">
                           Configure GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY, and
                           GITHUB_APP_WEBHOOK_SECRET on this deployment.
                        </p>
                     </div>
                  </div>
               </SettingsCard>
            ) : installations.length === 0 ? (
               <SettingsCard>
                  <div className="flex items-center gap-3 px-4 py-5">
                     <span className="inline-flex size-9 items-center justify-center rounded-md bg-muted">
                        <Github className="size-5" />
                     </span>
                     <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">No GitHub installation connected</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                           Install the app and choose the repositories this workspace may access.
                        </p>
                     </div>
                     {!canManage && (
                        <span className="text-xs text-muted-foreground">
                           Workspace admin required
                        </span>
                     )}
                  </div>
               </SettingsCard>
            ) : (
               <div className="flex flex-col gap-4">
                  {installations.map((installation) => (
                     <SettingsCard key={installation.id}>
                        <div className="flex items-center gap-3 px-4 py-3">
                           <Github className="size-5" />
                           <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                 {installation.accountLogin}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                 {installation.repositories.length} repositories ·{' '}
                                 {installation.repositorySelection === 'all'
                                    ? 'All repositories'
                                    : 'Selected repositories'}
                              </p>
                           </div>
                           {installation.suspended && (
                              <span className="text-xs text-destructive">Suspended</span>
                           )}
                           <Button variant="ghost" size="xs" asChild>
                              <a
                                 href={`https://github.com/settings/installations/${installation.installationId}`}
                                 target="_blank"
                                 rel="noreferrer"
                              >
                                 Manage
                                 <ExternalLink />
                              </a>
                           </Button>
                        </div>

                        {installation.repositories.length === 0 ? (
                           <div className="px-4 py-4 text-xs text-muted-foreground">
                              No repositories are available to this installation.
                           </div>
                        ) : (
                           installation.repositories.map((repository) => (
                              <div
                                 key={repository.id}
                                 className="flex flex-wrap items-center gap-3 px-4 py-3"
                              >
                                 <div className="min-w-40 flex-1">
                                    <a
                                       className="text-sm font-medium hover:underline"
                                       href={repository.htmlUrl}
                                       target="_blank"
                                       rel="noreferrer"
                                    >
                                       {repository.fullName}
                                    </a>
                                    <p className="text-xs text-muted-foreground">
                                       {repository.private ? 'Private' : 'Public'} repository
                                    </p>
                                 </div>
                                 <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    Team
                                    <select
                                       aria-label={`Team for ${repository.fullName}`}
                                       value={repository.teamId ?? ''}
                                       disabled={!canManage || busy === repository.id}
                                       onChange={(event) =>
                                          void updateRepository(repository.id, {
                                             teamId: event.target.value || null,
                                          })
                                       }
                                       className="h-8 max-w-44 rounded-md border bg-background px-2 text-sm text-foreground disabled:opacity-50"
                                    >
                                       <option value="">Not available to agents</option>
                                       {teams.map((team) => (
                                          <option key={team.id} value={team.id}>
                                             {team.name}
                                          </option>
                                       ))}
                                    </select>
                                 </label>
                                 {busy === repository.id && (
                                    <Loader2 className="size-4 animate-spin" />
                                 )}
                                 <Switch
                                    aria-label={`Enable ${repository.fullName}`}
                                    checked={repository.enabled}
                                    disabled={!canManage || busy === repository.id}
                                    onCheckedChange={(enabled) =>
                                       void updateRepository(repository.id, { enabled })
                                    }
                                 />
                              </div>
                           ))
                        )}

                        {canManage && (
                           <div className="flex items-center justify-end gap-2 px-4 py-3">
                              <Button
                                 variant="ghost"
                                 size="xs"
                                 disabled={busy !== null}
                                 onClick={() => setDisconnecting(installation)}
                              >
                                 <Unplug />
                                 Disconnect
                              </Button>
                           </div>
                        )}
                     </SettingsCard>
                  ))}

                  {canManage && (
                     <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        disabled={busy !== null}
                        onClick={() => void syncRepositories()}
                     >
                        {busy === 'sync' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        Sync repositories
                     </Button>
                  )}
               </div>
            )}
         </SettingsSection>

         <AlertDialog
            open={disconnecting !== null}
            onOpenChange={(open) => !open && setDisconnecting(null)}
         >
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect {disconnecting?.accountLogin}?</AlertDialogTitle>
                  <AlertDialogDescription>
                     Circle will remove its local repository access. The GitHub App remains
                     installed until you uninstall it in GitHub.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void disconnect()}>
                     Disconnect
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </SettingsShell>
   );
}
