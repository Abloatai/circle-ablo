import { redirect } from 'next/navigation';
import { defaultRouteFor, getViewerState } from '@/lib/session';

export default async function Home() {
   const state = await getViewerState();
   if (state.kind === 'anonymous') redirect('/sign-in');
   if (state.kind === 'no-workspace') redirect('/onboarding');
   redirect(await defaultRouteFor(state.viewer));
}
