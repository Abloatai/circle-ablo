'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

function SignInForm() {
   const router = useRouter();
   const invitationId = useSearchParams().get('invitation');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);

   async function onSubmit(event: React.FormEvent) {
      event.preventDefault();
      setPending(true);
      setError(null);
      const { error } = await authClient.signIn.email({ email, password });
      setPending(false);
      if (error) {
         setError(error.message ?? 'Could not sign in');
         return;
      }
      // The org and team a person lands in are resolved server-side.
      // Sent here by an invitation link: finish what they came to do.
      router.push(invitationId ? `/invite/${invitationId}` : '/');
      router.refresh();
   }

   return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
         <form
            onSubmit={onSubmit}
            className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8"
         >
            <div className="space-y-1.5">
               <h1 className="text-lg font-medium">Sign in to Circle</h1>
               <p className="text-sm text-muted-foreground">
                  Use your workspace email and password.
               </p>
            </div>

            <div className="space-y-3">
               <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                     id="email"
                     type="email"
                     autoComplete="email"
                     required
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                  />
               </div>
               <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                     id="password"
                     type="password"
                     autoComplete="current-password"
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                  />
               </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-3">
               <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? 'Signing in…' : 'Sign in'}
               </Button>
               <p className="text-center text-sm text-muted-foreground">
                  New here?{' '}
                  <Link
                     href={invitationId ? `/sign-up?invitation=${invitationId}` : '/sign-up'}
                     className="text-foreground underline underline-offset-4"
                  >
                     Create an account
                  </Link>
               </p>
            </div>
         </form>
      </main>
   );
}

/**
 * `useSearchParams` opts a page into client-side rendering unless it sits
 * behind a Suspense boundary; without one the build refuses to prerender this
 * route. The fallback is the form's own frame, so the box does not pop in.
 */
export default function SignInPage() {
   return (
      <Suspense fallback={<FormFrame />}>
         <SignInForm />
      </Suspense>
   );
}

function FormFrame() {
   return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
         <div className="w-full max-w-sm rounded-lg border bg-card p-8">
            <h1 className="text-lg font-medium">Sign in to Circle</h1>
         </div>
      </main>
   );
}
