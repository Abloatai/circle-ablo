import { getViewer } from '@/lib/session';

/**
 * Resolves a pull request URL against GitHub.
 *
 * The point of this route rather than a fetch from the browser: a token. The
 * unauthenticated GitHub API allows 60 requests an hour per IP, which is every
 * viewer of a busy issue sharing one budget; with `GITHUB_TOKEN` set it is
 * 5,000 and private repositories resolve too. Either way the token never
 * reaches the browser.
 *
 * A URL that is not a GitHub pull request, or one this deployment cannot see,
 * is not an error — it comes back unresolved and the row keeps the state the
 * person set by hand. A link to a GitLab merge request is still a useful link.
 */
export async function POST(request: Request): Promise<Response> {
   const viewer = await getViewer();
   if (!viewer) return Response.json({ error: 'Not signed in' }, { status: 401 });

   const { url } = (await request.json()) as { url?: string };
   const parsed = parsePullRequestUrl(url ?? '');
   if (!parsed) return Response.json({ resolved: false });

   const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'circle',
   };
   if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

   try {
      const response = await fetch(
         `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
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
         title: pr.title ?? `${parsed.owner}/${parsed.repo}#${parsed.number}`,
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

/** `https://github.com/owner/repo/pull/123` → its parts, or null. */
function parsePullRequestUrl(url: string): { owner: string; repo: string; number: string } | null {
   try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
      const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      return match ? { owner: match[1], repo: match[2], number: match[3] } : null;
   } catch {
      return null;
   }
}
