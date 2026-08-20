import { chromium, type FullConfig } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEV_PASSWORD } from '@/db/dev-password';
import { closeDb } from './helpers/db';
import { findPeople, isLoaded, type TestPerson } from './helpers/people';

export const AUTH_DIR = path.join(process.cwd(), 'tests', '.auth');
export const PEOPLE_FILE = path.join(AUTH_DIR, 'people.json');

/**
 * Signs each test person in **once** and saves their cookies.
 *
 * Better Auth rate-limits `/sign-in/email`, and a suite that signs in per test
 * starts returning 429 within a few files — which looks exactly like a broken
 * login. Signing in once here and reusing the storage state avoids the limiter
 * entirely and makes the suite faster.
 */
async function globalSetup(config: FullConfig): Promise<void> {
   // The unit project touches neither a browser nor the database; making
   // `pnpm test:unit` boot a server and sign three people in is how a fast
   // suite stops being run.
   if (process.argv.includes('--project=unit')) return;

   const baseURL =
      config.projects.find((p) => p.use.baseURL)?.use.baseURL ?? 'http://localhost:3100';

   await mkdir(AUTH_DIR, { recursive: true });
   const people = await findPeople(3);

   const browser = await chromium.launch();
   try {
      for (const person of people) {
         const context = await browser.newContext({ baseURL });
         const page = await context.newPage();
         await page.goto('/sign-in');
         await page.getByRole('textbox', { name: /email/i }).fill(person.email);
         await page.locator('input[type="password"]').fill(DEV_PASSWORD);
         await page.getByRole('button', { name: /sign in/i }).click();
         await page.waitForURL(isLoaded, { timeout: 60_000 });
         await context.storageState({ path: storageFor(person.id) });
         await context.close();
      }
      await writeFile(PEOPLE_FILE, JSON.stringify(people, null, 2));
      console.log(`signed in ${people.length} people: ${people.map((p) => p.id).join(', ')}`);
   } finally {
      await browser.close();
      await closeDb();
   }
}

export const storageFor = (userId: string): string => path.join(AUTH_DIR, `${userId}.json`);

export default globalSetup;
export type { TestPerson };
