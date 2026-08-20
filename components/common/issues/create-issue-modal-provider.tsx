'use client';

import { CreateNewIssue } from '@/components/layout/sidebar/create-new-issue';

/**
 * Mounts the "new issue" dialog once for the whole app, so the command palette
 * and a board column header can open it on a page that has no sidebar.
 */
export function CreateIssueModalProvider() {
   return <CreateNewIssue />;
}
