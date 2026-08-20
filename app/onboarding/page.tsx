'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createWorkspaceAction, type OnboardingResult } from './actions';

const initialState: OnboardingResult = {};

export default function OnboardingPage() {
   const [state, action, pending] = useActionState(createWorkspaceAction, initialState);

   return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
         <form action={action} className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8">
            <div className="space-y-1.5">
               <h1 className="text-lg font-medium">Create your workspace</h1>
               <p className="text-sm text-muted-foreground">
                  A workspace holds your teams, projects and issues.
               </p>
            </div>

            <div className="space-y-3">
               <div className="space-y-1.5">
                  <Label htmlFor="organizationName">Workspace name</Label>
                  <Input id="organizationName" name="organizationName" required autoFocus />
               </div>
               <div className="space-y-1.5">
                  <Label htmlFor="teamName">First team</Label>
                  <Input id="teamName" name="teamName" required defaultValue="Core" />
               </div>
               <div className="space-y-1.5">
                  <Label htmlFor="teamKey">Team key</Label>
                  <Input
                     id="teamKey"
                     name="teamKey"
                     required
                     defaultValue="CORE"
                     maxLength={6}
                     className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                     Prefixes every issue in the team, like CORE-123.
                  </p>
               </div>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
               {pending ? 'Creating workspace…' : 'Create workspace'}
            </Button>
         </form>
      </main>
   );
}
