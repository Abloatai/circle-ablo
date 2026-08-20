'use server';

import { redirect } from 'next/navigation';
import { getViewerState } from '@/lib/session';
import { createWorkspace, slugify } from '@/lib/workspace';

export interface OnboardingResult {
   error?: string;
}

export async function createWorkspaceAction(
   _previous: OnboardingResult,
   formData: FormData
): Promise<OnboardingResult> {
   const state = await getViewerState();
   if (state.kind === 'anonymous') redirect('/sign-in');
   if (state.kind === 'member') redirect('/');

   const organizationName = String(formData.get('organizationName') ?? '').trim();
   const teamName = String(formData.get('teamName') ?? '').trim();
   const teamKey = String(formData.get('teamKey') ?? '')
      .trim()
      .toUpperCase();

   if (!organizationName) return { error: 'Give the workspace a name' };
   if (!teamName) return { error: 'Give the first team a name' };
   if (!/^[A-Z][A-Z0-9]{1,5}$/.test(teamKey)) {
      return { error: 'Team key is 2–6 letters or digits, starting with a letter' };
   }

   const slug = slugify(organizationName);
   if (!slug) return { error: 'That workspace name has no letters or digits in it' };

   try {
      await createWorkspace({
         userId: state.userId,
         organizationName,
         slug,
         teamName,
         teamKey,
      });
   } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the workspace';
      return { error: message.includes('slug') ? 'That workspace name is taken' : message };
   }

   redirect(`/${slug}/team/${teamKey}/all`);
}
