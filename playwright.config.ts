import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * The runner's own process needs the database credentials — the assertions in
 * `tests/helpers/db.ts` talk to Postgres directly. Next loads `.env.local`
 * for the server it starts, but nothing loads it for this process.
 */
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

/**
 * Integration tests for Circle.
 *
 * These run against a **production build and a real database**, not mocks. The
 * bugs this project keeps hitting are writes that appear to succeed — a
 * component that reports success and saves nothing, a field that saves and
 * reads back empty, a pool that wedges. None of those are visible to a unit
 * test, and none are visible to a test that only checks the DOM. Every write
 * test here asserts against Postgres.
 *
 * `next dev` degrades badly under repeated automation, so this builds and runs
 * `next start`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
   testDir: './tests',
   // Writes race each other through one sync stream and one 0.25 CU database;
   // serial is slower and honest.
   workers: 1,
   fullyParallel: false,
   forbidOnly: Boolean(process.env.CI),
   retries: 0,
   reporter: [['list']],
   timeout: 120_000,
   expect: { timeout: 20_000 },

   globalSetup: './tests/global-setup.ts',

   projects: [
      {
         name: 'unit',
         testDir: './tests/unit',
         use: {},
      },
      {
         name: 'e2e',
         testDir: './tests/e2e',
         use: {
            ...devices['Desktop Chrome'],
            baseURL: `http://localhost:${PORT}`,
            // Sync is not instant; give assertions room before they fail.
            actionTimeout: 30_000,
         },
      },
   ],

   // Only the e2e project needs a server; a unit-only run skips it.
   webServer: process.argv.includes('--project=unit')
      ? undefined
      : {
           command: `npx next start -p ${PORT}`,
           url: `http://localhost:${PORT}/sign-in`,
           reuseExistingServer: !process.env.CI,
           timeout: 180_000,
           stdout: 'ignore',
           stderr: 'pipe',
           env: {
              // Better Auth refuses a request whose origin is not BETTER_AUTH_URL,
              // and the tests run on their own port so they cannot collide with a
              // dev server. Without this every sign-in fails with "Invalid origin".
              BETTER_AUTH_URL: `http://localhost:${PORT}`,
           },
        },
});
