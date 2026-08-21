export interface PullRequestCoordinates {
   owner: string;
   repository: string;
   number: number;
}

/** Strictly accepts a github.com pull request URL and discards query/fragment data. */
export function parseGitHubPullRequestUrl(url: string): PullRequestCoordinates | null {
   try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
      const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
      if (!match) return null;
      return { owner: match[1], repository: match[2], number: Number(match[3]) };
   } catch {
      return null;
   }
}

/** True when text contains the same GitHub PR, even inside rich-text JSON. */
export function mentionsGitHubPullRequest(text: string, target: PullRequestCoordinates): boolean {
   const links = text.matchAll(
      /https?:\/\/(?:www\.)?github\.com\/([^/\s"'<>]+)\/([^/\s"'<>]+)\/pull\/(\d+)/gi
   );
   for (const link of links) {
      if (
         link[1].toLowerCase() === target.owner.toLowerCase() &&
         link[2].toLowerCase() === target.repository.toLowerCase() &&
         Number(link[3]) === target.number
      ) {
         return true;
      }
   }
   return false;
}
