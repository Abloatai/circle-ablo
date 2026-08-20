/**
 * The password every seeded person signs in with.
 *
 * Development only — `db/seed.ts` hashes it for each fixture user, and the
 * tests sign in with it. It lives here rather than inside the seed because
 * importing `db/seed.ts` runs it, and running it truncates the database.
 */
export const DEV_PASSWORD = 'circle-dev-password';
