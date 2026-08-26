const SEARCHABLE_EXTENSIONS = new Set([
   '.c',
   '.cc',
   '.cpp',
   '.cs',
   '.css',
   '.go',
   '.graphql',
   '.gql',
   '.h',
   '.hpp',
   '.html',
   '.java',
   '.js',
   '.jsx',
   '.json',
   '.kt',
   '.kts',
   '.md',
   '.mdx',
   '.mjs',
   '.cjs',
   '.php',
   '.prisma',
   '.py',
   '.rb',
   '.rs',
   '.scss',
   '.sh',
   '.sql',
   '.swift',
   '.toml',
   '.ts',
   '.tsx',
   '.txt',
   '.vue',
   '.xml',
   '.yaml',
   '.yml',
]);

const SEARCHABLE_NAMES = new Set(['dockerfile', 'gemfile', 'makefile', 'procfile', 'rakefile']);

const basename = (path: string) => path.split('/').at(-1) ?? path;

/** A repository-relative path with no traversal or ambiguous separators. */
export function normalizeRepositoryPath(path: string): string | null {
   const normalized = path
      .trim()
      .replaceAll('\\', '/')
      .replace(/^\/+|\/+$/g, '');
   if (!normalized) return null;
   const parts = normalized.split('/');
   if (parts.some((part) => !part || part === '.' || part === '..')) return null;
   return parts.join('/');
}

export function isSearchableRepositoryPath(path: string): boolean {
   const name = basename(path).toLowerCase();
   if (
      name.endsWith('.min.js') ||
      name.endsWith('.min.css') ||
      name.endsWith('.map') ||
      name.endsWith('.lock') ||
      name === 'package-lock.json' ||
      name === 'pnpm-lock.yaml' ||
      name === 'yarn.lock'
   ) {
      return false;
   }
   if (SEARCHABLE_NAMES.has(name)) return true;
   const dot = name.lastIndexOf('.');
   return dot >= 0 && SEARCHABLE_EXTENSIONS.has(name.slice(dot));
}

export function numberedExcerpt(
   content: string,
   requestedStartLine = 1,
   requestedEndLine?: number,
   maxLines = 400
): {
   content: string;
   startLine: number;
   endLine: number;
   totalLines: number;
   truncated: boolean;
} {
   const lines = content.replaceAll('\r\n', '\n').split('\n');
   const startLine = Math.max(1, Math.min(lines.length, Math.floor(requestedStartLine)));
   const desiredEnd = requestedEndLine === undefined ? startLine + maxLines - 1 : requestedEndLine;
   const endLine = Math.max(
      startLine,
      Math.min(lines.length, Math.floor(desiredEnd), startLine + maxLines - 1)
   );
   const width = String(endLine).length;
   return {
      content: lines
         .slice(startLine - 1, endLine)
         .map((line, index) => `${String(startLine + index).padStart(width)} | ${line}`)
         .join('\n'),
      startLine,
      endLine,
      totalLines: lines.length,
      truncated: startLine > 1 || endLine < lines.length,
   };
}

export function literalLineMatches(
   content: string,
   query: string,
   caseSensitive: boolean,
   limit: number
): Array<{ line: number; text: string }> {
   const needle = caseSensitive ? query : query.toLowerCase();
   const matches: Array<{ line: number; text: string }> = [];
   for (const [index, text] of content.replaceAll('\r\n', '\n').split('\n').entries()) {
      const haystack = caseSensitive ? text : text.toLowerCase();
      if (!haystack.includes(needle)) continue;
      matches.push({ line: index + 1, text: text.slice(0, 500) });
      if (matches.length >= limit) break;
   }
   return matches;
}
