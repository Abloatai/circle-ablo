'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

function SignUpForm() {
   const router = useRouter();
   const invitationId = useSearchParams().get('invitation');
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);

   async function onSubmit(event: React.FormEvent) {
      event.preventDefault();
      setPending(true);
      setError(null);
      const { error } = await authClient.signUp.email({ name, email, password });
      setPending(false);
      if (error) {
         setError(error.message ?? 'Could not create the account');
         return;
      }
      // A new account belongs to no workspace yet; / routes them to onboarding.
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
               <h1 className="text-lg font-medium">Create your account</h1>
               <p className="text-sm text-muted-foreground">You&apos;ll set up a workspace next.</p>
            </div>

            <div className="space-y-3">
               <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                     id="name"
                     autoComplete="name"
                     required
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                  />
               </div>
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
                     autoComplete="new-password"
                     required
                     minLength={8}
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
               </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-3">
               <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? 'Creating account…' : 'Create account'}
               </Button>
               <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                     href={invitationId ? `/sign-in?invitation=${invitationId}` : '/sign-in'}
                     className="text-foreground underline underline-offset-4"
                  >
                     Sign in
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
export default function SignUpPage() {
   return (
      <Suspense fallback={<FormFrame />}>
         <SignUpForm />
      </Suspense>
   );
}

function FormFrame() {
   return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
         <div className="w-full max-w-sm rounded-lg border bg-card p-8">
            <h1 className="text-lg font-medium">Create your Circle account</h1>
         </div>
      </main>
   );
}
