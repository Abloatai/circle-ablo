import { sign } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getGitHubAppConfig } from './config';
import type { GitHubMergeMethod } from './merge-request';
import { parseGitHubPullRequestUrl } from './pull-request-url';

const API = 'https://api.github.com';
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

export class GitHubApiError extends Error {
   constructor(
      message: string,
      readonly status: number
   ) {
      super(message);
   }
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function appJwt(): string {
   const config = getGitHubAppConfig();
   const now = Math.floor(Date.now() / 1000);
   const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: config.appId,
   })}`;
   const signature = sign('RSA-SHA256', Buffer.from(unsigned), config.privateKey).toString(
      'base64url'
   );
   return `${unsigned}.${signature}`;
}

async function request<T>(
   path: string,
   token: string,
   init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<T> {
   const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
         'Accept': 'application/vnd.github+json',
         'Authorization': `Bearer ${token}`,
         'X-GitHub-Api-Version': '2022-11-28',
         'User-Agent': 'circle',
         ...init.headers,
      },
      signal: init.signal ?? AbortSignal.timeout(15_000),
   });
   if (!response.ok) {
      let detail = '';
      try {
         detail = ((await response.json()) as { message?: string }).message ?? '';
      } catch {
         // GitHub may return an empty body for a failed request.
      }
      throw new GitHubApiError(detail || `GitHub returned ${response.status}`, response.status);
   }
   return (await response.json()) as T;
}

export async function githubAppRequest<T>(path: string): Promise<T> {
   return request<T>(path, appJwt());
}

export async function installationToken(installationId: number): Promise<string> {
   const cached = tokenCache.get(installationId);
   if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

   const response = await request<{ token: string; expires_at: string }>(
      `/app/installations/${installationId}/access_tokens`,
      appJwt(),
      { method: 'POST' }
   );
   tokenCache.set(installationId, {
      token: response.token,
      expiresAt: new Date(response.expires_at).getTime(),
   });
   return response.token;
}

export async function githubInstallationRequest<T>(
   installationId: number,
   path: string,
   init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<T> {
   return request<T>(path, await installationToken(installationId), init);
}

interface GitHubInstallationPayload {
   id: number;
   account: { id: number; login: string; type: string };
   repository_selection: string;
   suspended_at: string | null;
}

interface GitHubRepositoryPayload {
   id: number;
   name: string;
   full_name: string;
   html_url: string;
   private: boolean;
   owner: { login: string };
}

export async function connectGitHubInstallation(input: {
   installationId: number;
   organizationId: string;
   userId: string;
}) {
   const installation = await githubAppRequest<GitHubInstallationPayload>(
      `/app/installations/${input.installationId}`
   );
   const [existing] = await db
      .select()
      .from(t.githubInstallation)
      .where(eq(t.githubInstallation.installationId, input.installationId))
      .limit(1);
   if (existing && existing.organizationId !== input.organizationId) {
      throw new Error('That GitHub installation is already connected to another workspace');
   }

   const id = existing?.id ?? `github_installation_${installation.id}`;
   await db
      .insert(t.githubInstallation)
      .values({
         id,
         organizationId: input.organizationId,
         installationId: installation.id,
         accountId: installation.account.id,
         accountLogin: installation.account.login,
         accountType: installation.account.type,
         repositorySelection: installation.repository_selection,
         createdBy: input.userId,
         suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
      })
      .onConflictDoUpdate({
         target: t.githubInstallation.installationId,
         set: {
            accountId: installation.account.id,
            accountLogin: installation.account.login,
            accountType: installation.account.type,
            repositorySelection: installation.repository_selection,
            suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
            updatedAt: new Date(),
         },
      });

   await syncGitHubRepositories(id, installation.id, input.organizationId);
   return id;
}

export async function syncGitHubRepositories(
   installationRecordId: string,
   installationId: number,
   organizationId: string
): Promise<number> {
   const repositories: GitHubRepositoryPayload[] = [];
   for (let page = 1; page <= 100; page += 1) {
      const response = await githubInstallationRequest<{ repositories: GitHubRepositoryPayload[] }>(
         installationId,
         `/installation/repositories?per_page=100&page=${page}`
      );
      repositories.push(...response.repositories);
      if (response.repositories.length < 100) break;
   }

   const teams = await db
      .select({ id: t.team.id })
      .from(t.team)
      .where(eq(t.team.organizationId, organizationId));
   const onlyTeamId = teams.length === 1 ? teams[0].id : null;

   await db.transaction(async (tx) => {
      for (const repository of repositories) {
         await tx
            .insert(t.githubRepository)
            .values({
               id: `github_repository_${installationId}_${repository.id}`,
               installationId: installationRecordId,
               githubRepositoryId: repository.id,
               owner: repository.owner.login,
               name: repository.name,
               fullName: repository.full_name,
               htmlUrl: repository.html_url,
               private: repository.private,
               teamId: onlyTeamId,
            })
            .onConflictDoUpdate({
               target: [t.githubRepository.installationId, t.githubRepository.githubRepositoryId],
               set: {
                  owner: repository.owner.login,
                  name: repository.name,
                  fullName: repository.full_name,
                  htmlUrl: repository.html_url,
                  private: repository.private,
                  updatedAt: new Date(),
               },
            });
      }

      const ids = repositories.map((repository) => repository.id);
      const current = await tx
         .select({ id: t.githubRepository.id, githubId: t.githubRepository.githubRepositoryId })
         .from(t.githubRepository)
         .where(eq(t.githubRepository.installationId, installationRecordId));
      const removed = current.filter((repository) => !ids.includes(repository.githubId));
      if (removed.length) {
         await tx.delete(t.githubRepository).where(
            inArray(
               t.githubRepository.id,
               removed.map((repository) => repository.id)
            )
         );
      }
   });

   return repositories.length;
}

export interface GitHubPullRequestInspection {
   url: string;
   repository: string;
   number: number;
   title: string;
   body: string;
   state: 'open' | 'closed' | 'merged' | 'draft';
   author: string;
   baseBranch: string;
   headBranch: string;
   headSha: string;
   additions: number;
   deletions: number;
   changedFiles: number;
   commits: Array<{ sha: string; message: string; author: string | null }>;
   files: Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch?: string;
   }>;
   truncated: boolean;
}

async function connectedInstallationForRepository(input: {
   organizationId: string;
   teamId: string;
   fullName: string;
}): Promise<number> {
   const [connected] = await db
      .select({ installationId: t.githubInstallation.installationId })
      .from(t.githubRepository)
      .innerJoin(
         t.githubInstallation,
         eq(t.githubInstallation.id, t.githubRepository.installationId)
      )
      .where(
         and(
            eq(t.githubInstallation.organizationId, input.organizationId),
            isNull(t.githubInstallation.suspendedAt),
            eq(t.githubRepository.enabled, true),
            eq(sql`lower(${t.githubRepository.fullName})`, input.fullName.toLowerCase()),
            eq(t.githubRepository.teamId, input.teamId)
         )
      )
      .limit(1);
   if (!connected) {
      throw new Error('That repository is not enabled for this Circle team');
   }
   return connected.installationId;
}

export async function inspectPullRequest(input: {
   organizationId: string;
   teamId: string;
   url: string;
}): Promise<GitHubPullRequestInspection> {
   const coordinates = parseGitHubPullRequestUrl(input.url);
   if (!coordinates) throw new Error('That is not a GitHub pull request URL');
   const fullName = `${coordinates.owner}/${coordinates.repository}`;

   const installationId = await connectedInstallationForRepository({
      organizationId: input.organizationId,
      teamId: input.teamId,
      fullName,
   });

   const path = `/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repository)}/pulls/${coordinates.number}`;
   const [pull, files, commits] = await Promise.all([
      githubInstallationRequest<{
         html_url: string;
         title: string;
         body: string | null;
         state: string;
         draft: boolean;
         merged_at: string | null;
         user: { login: string };
         base: { ref: string };
         head: { ref: string; sha: string };
         additions: number;
         deletions: number;
         changed_files: number;
      }>(installationId, path),
      githubInstallationRequest<
         Array<{
            filename: string;
            status: string;
            additions: number;
            deletions: number;
            patch?: string;
         }>
      >(installationId, `${path}/files?per_page=100`),
      githubInstallationRequest<
         Array<{ sha: string; commit: { message: string; author: { name: string } | null } }>
      >(installationId, `${path}/commits?per_page=100`),
   ]);

   let remainingPatchCharacters = 120_000;
   let truncated = pull.changed_files > files.length || commits.length === 100;
   const boundedFiles = files.map((file) => {
      const patch = file.patch?.slice(0, Math.max(0, remainingPatchCharacters));
      if (file.patch && patch?.length !== file.patch.length) truncated = true;
      remainingPatchCharacters -= patch?.length ?? 0;
      return { ...file, patch: patch || undefined };
   });

   return {
      url: pull.html_url,
      repository: fullName,
      number: coordinates.number,
      title: pull.title,
      body: pull.body ?? '',
      state: pull.merged_at
         ? 'merged'
         : pull.draft
           ? 'draft'
           : pull.state === 'closed'
             ? 'closed'
             : 'open',
      author: pull.user.login,
      baseBranch: pull.base.ref,
      headBranch: pull.head.ref,
      headSha: pull.head.sha,
      additions: pull.additions,
      deletions: pull.deletions,
      changedFiles: pull.changed_files,
      commits: commits.map((commit) => ({
         sha: commit.sha,
         message: commit.commit.message,
         author: commit.commit.author?.name ?? null,
      })),
      files: boundedFiles,
      truncated,
   };
}

export interface GitHubPullRequestMergeResult {
   merged: boolean;
   alreadyMerged: boolean;
   sha: string;
   message: string;
}

/**
 * Merge exactly the revision a person approved.
 *
 * Repository authorization is repeated here rather than inherited from the
 * agent's earlier inspection, and GitHub receives the pinned head SHA so a
 * newly pushed commit makes the operation fail closed.
 */
export async function mergePullRequest(input: {
   organizationId: string;
   teamId: string;
   url: string;
   expectedHeadSha: string;
   mergeMethod: GitHubMergeMethod;
}): Promise<GitHubPullRequestMergeResult> {
   const coordinates = parseGitHubPullRequestUrl(input.url);
   if (!coordinates) throw new Error('That is not a GitHub pull request URL');
   if (!/^[0-9a-f]{40}$/i.test(input.expectedHeadSha)) {
      throw new Error('The approved pull request revision is invalid');
   }

   const installationId = await connectedInstallationForRepository({
      organizationId: input.organizationId,
      teamId: input.teamId,
      fullName: `${coordinates.owner}/${coordinates.repository}`,
   });
   const path = `/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repository)}/pulls/${coordinates.number}`;
   const pull = await githubInstallationRequest<{
      state: string;
      draft: boolean;
      merged_at: string | null;
      merge_commit_sha: string | null;
      head: { sha: string };
   }>(installationId, path);

   if (pull.merged_at) {
      return {
         merged: true,
         alreadyMerged: true,
         sha: pull.merge_commit_sha ?? pull.head.sha,
         message: 'Pull request was already merged.',
      };
   }
   if (pull.state !== 'open') throw new Error('The pull request is not open');
   if (pull.draft) throw new Error('Draft pull requests cannot be merged');
   if (pull.head.sha.toLowerCase() !== input.expectedHeadSha.toLowerCase()) {
      throw new GitHubApiError(
         'The pull request changed after approval was requested. Ask Scout to inspect it again.',
         409
      );
   }

   const result = await githubInstallationRequest<{
      sha: string;
      merged: boolean;
      message: string;
   }>(installationId, `${path}/merge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         sha: input.expectedHeadSha,
         merge_method: input.mergeMethod,
      }),
   });
   if (!result.merged) throw new Error(result.message || 'GitHub did not merge the pull request');

   return {
      merged: true,
      alreadyMerged: false,
      sha: result.sha,
      message: result.message,
   };
}
