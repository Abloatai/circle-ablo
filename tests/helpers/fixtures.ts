import { test as base, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TestPerson } from './people';
import { closeDb } from './db';

const AUTH_DIR = path.join(process.cwd(), 'tests', '.auth');

async function people(): Promise<TestPerson[]> {
   return JSON.parse(await readFile(path.join(AUTH_DIR, 'people.json'), 'utf8')) as TestPerson[];
}

/**
 * `alice` and `bob` are two different signed-in people, and `secondTab` is
 * alice again in a separate browser context.
 *
 * The two-browser check is the point: workspace data is supposed to arrive
 * without a reload, and a reload test passes either way because the row is
 * usually in the database regardless.
 */
export const test = base.extend<
   { alice: Page; bob: Page; secondTab: Page; who: TestPerson[] },
   { dbLifecycle: void }
>({
   /**
    * Closes the Postgres pool once, when the worker finishes.
    *
    * Doing this in a per-file `afterAll` closes the pool the *other* spec files
    * are still using — the first file to finish takes the rest down with it,
    * which is exactly what happened the first time this suite ran end to end.
    */
   dbLifecycle: [
      async ({}, use) => {
         await use();
         await closeDb();
      },
      { scope: 'worker', auto: true },
   ],

   who: async ({}, use) => {
      await use(await people());
   },

   alice: async ({ browser, who }, use) => {
      const context = await browser.newContext({
         storageState: path.join(AUTH_DIR, `${who[0].id}.json`),
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
   },

   bob: async ({ browser, who }, use) => {
      const context = await browser.newContext({
         storageState: path.join(AUTH_DIR, `${who[1].id}.json`),
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
   },

   secondTab: async ({ browser, who }, use) => {
      const context = await browser.newContext({
         storageState: path.join(AUTH_DIR, `${who[0].id}.json`),
      });
      const page = await context.newPage();
      await use(page);
      await context.close();
   },
});

export { expect } from '@playwright/test';
