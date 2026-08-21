import { getViewer } from '@/lib/session';
import { inspectPullRequest } from '@/lib/github/app';
import { parseGitHubPullRequestUrl } from '@/lib/github/pull-request-url';

/**
 * Resolves a pull request URL against GitHub.
 *
 * The point of this route rather than a fetch from the browser is that private
 * repository access uses a short-lived GitHub App installation token. The
 * token never reaches the browser and the repository must be enabled for the
 * issue's team. Public repositories can still resolve without an installation.
 *
 * A URL that is not a GitHub pull request, or one this deployment cannot see,
 * is not an error — it comes back unresolved and the row keeps the state the
 * person set by hand. A link to a GitLab merge request is still a useful link.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { url, teamId } = (await request.json()) as { url?: string; teamId?: string };
   const parsed = parseGitHubPullRequestUrl(url ?? '');
   if (!parsed) return Response.json({ resolved: false });

   if (teamId && viewer.teamIds.includes(teamId)) {
      try {
         const pull = await inspectPullRequest({
            organizationId: viewer.organizationId,
            teamId,
            url: url!,
         });
         return Response.json({ resolved: true, title: pull.title, state: pull.state });
      } catch {
         // It may be a public repository that is intentionally not connected.
         // Resolve only its public metadata below; no broader credential is used.
      }
   }

   const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'circle',
   };
   try {
      const response = await fetch(
         `https://api.github.com/repos/${parsed.owner}/${parsed.repository}/pulls/${parsed.number}`,
         // Bounded, like every other outbound call here: a hanging GitHub is
         // not a reason to hold a request open.
         { headers, signal: AbortSignal.timeout(8000) }
      );
      if (!response.ok) return Response.json({ resolved: false, status: response.status });

      const pr = (await response.json()) as {
         title?: string;
         state?: string;
         draft?: boolean;
         merged_at?: string | null;
      };

      return Response.json({
         resolved: true,
         title: pr.title ?? `${parsed.owner}/${parsed.repository}#${parsed.number}`,
         // GitHub's `state` is only open/closed; merged and draft are separate
         // flags, and both matter more than "closed" to someone reading this.
         state: pr.merged_at
            ? 'merged'
            : pr.draft
              ? 'draft'
              : pr.state === 'closed'
                ? 'closed'
                : 'open',
      });
   } catch {
      return Response.json({ resolved: false });
   }
}
