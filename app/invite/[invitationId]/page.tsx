import { redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { auth } from '@/lib/auth';
import { AcceptInvitation } from './accept-invitation';

/**
 * The page an invitation link opens.
 *
 * It shows who invited you and to what before anything happens, because a link
 * from an email should say what accepting it does. Signing in or up first is
 * fine — the invitation is still here afterwards.
 */
export default async function InvitePage({
   params,
}: {
   params: Promise<{ invitationId: string }>;
}) {
   const { invitationId } = await params;

   const [invitation] = await db
      .select({
         id: t.invitation.id,
         email: t.invitation.email,
         status: t.invitation.status,
         expiresAt: t.invitation.expiresAt,
         organizationName: t.organization.name,
         organizationSlug: t.organization.slug,
         inviterName: t.user.name,
      })
      .from(t.invitation)
      .innerJoin(t.organization, eq(t.organization.id, t.invitation.organizationId))
      .leftJoin(t.user, eq(t.user.id, t.invitation.inviterId))
      .where(eq(t.invitation.id, invitationId))
      .limit(1);

   if (!invitation) return <Message title="That invitation no longer exists." />;
   if (invitation.status !== 'pending') {
      return <Message title={`This invitation was already ${invitation.status}.`} />;
   }
   if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return <Message title="This invitation has expired." detail="Ask for a new one." />;
   }

   const session = await auth.api.getSession({ headers: await headers() });
   if (!session?.user) {
      redirect(`/sign-in?invitation=${invitationId}`);
   }

   // An invitation is addressed to one person; signing in as someone else is
   // the common mistake, so say so rather than failing on accept.
   const addressedToSomeoneElse =
      session.user.email.toLowerCase() !== invitation.email.toLowerCase();

   return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
         <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8">
            <div className="space-y-1.5">
               <h1 className="text-lg font-medium">Join {invitation.organizationName}</h1>
               <p className="text-sm text-muted-foreground">
                  {invitation.inviterName ?? 'Someone'} invited {invitation.email}.
               </p>
            </div>

            {addressedToSomeoneElse ? (
               <p className="text-sm text-destructive">
                  You are signed in as {session.user.email}. Sign in as {invitation.email} to accept
                  this invitation.
               </p>
            ) : (
               <AcceptInvitation
                  invitationId={invitation.id}
                  organizationSlug={invitation.organizationSlug ?? ''}
               />
            )}
         </div>
      </main>
   );
}

function Message({ title, detail }: { title: string; detail?: string }) {
   return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
         <div className="w-full max-w-sm space-y-3 rounded-lg border bg-card p-8 text-center">
            <p className="text-sm">{title}</p>
            {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
            <Link href="/" className="text-sm underline underline-offset-4">
               Go to Circle
            </Link>
         </div>
      </main>
   );
}
