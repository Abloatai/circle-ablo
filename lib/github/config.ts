export interface GitHubAppConfig {
   appId: string;
   slug: string;
   privateKey: string;
   webhookSecret: string;
}

const normalizePrivateKey = (value: string): string => {
   const unescaped = value.replace(/\\n/g, '\n');
   if (unescaped.includes('BEGIN') && unescaped.includes('PRIVATE KEY')) return unescaped;
   return Buffer.from(value, 'base64').toString('utf8');
};

export function isGitHubAppConfigured(): boolean {
   return Boolean(
      process.env.GITHUB_APP_ID &&
         process.env.GITHUB_APP_SLUG &&
         process.env.GITHUB_APP_PRIVATE_KEY &&
         process.env.GITHUB_APP_WEBHOOK_SECRET
   );
}

export function getGitHubAppConfig(): GitHubAppConfig {
   if (!isGitHubAppConfigured()) {
      throw new Error(
         'GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_WEBHOOK_SECRET.'
      );
   }

   return {
      appId: process.env.GITHUB_APP_ID!,
      slug: process.env.GITHUB_APP_SLUG!,
      privateKey: normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY!),
      webhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET!,
   };
}
