import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { organization } from 'better-auth/plugins';
import { db } from '@/db';
import { invitationEmail, sendEmail } from '@/lib/email';

/**
 * Identity for Circle.
 *
 * The organization plugin is what makes the rest of the stack work: it owns
 * `organization`, `member`, `team` and `teamMember`, and puts
 * `activeOrganizationId` / `activeTeamId` on the session. Those are the exact
 * fields Ablo's `identityRoles` read to decide which sync groups a person may
 * subscribe to, so this file is the root of the permission model — not just login.
 */
export const auth = betterAuth({
   appName: 'Circle',
   database: drizzleAdapter(db, { provider: 'pg' }),
   emailAndPassword: { enabled: true },
   user: {
      additionalFields: {
         /** 'agent' rows are eve agents; they are assignable like anyone else. */
         type: { type: 'string', defaultValue: 'human', input: false },
         /** Presence dot in the member lists. */
         status: { type: 'string', defaultValue: 'offline', input: false },
         /** IANA zone, used to show a member's local time. */
         timezone: { type: 'string', required: false },
      },
   },
   plugins: [
      organization({
         teams: { enabled: true, defaultTeam: { enabled: false } },
         async sendInvitationEmail({ id, email, organization: org, inviter }) {
            const base = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
            const { subject, text, html } = invitationEmail({
               inviterName: inviter.user.name || inviter.user.email,
               organizationName: org.name,
               acceptUrl: `${base}/invite/${id}`,
            });
            await sendEmail({ to: email, subject, text, html });
         },
         schema: {
            team: {
               additionalFields: {
                  /** Short key in URLs and issue identifiers: CORE, DESIGN. */
                  key: { type: 'string', required: true },
                  icon: { type: 'string', required: false },
                  color: { type: 'string', required: false },
               },
            },
         },
      }),
      // Must stay last: it lets server actions set cookies.
      nextCookies(),
   ],
});

export type Session = typeof auth.$Infer.Session;
