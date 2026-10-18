'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAblo, useRecordPresence } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

import { presenceForSessions, type Presence } from '@/lib/data/presence';
export type { Presence } from '@/lib/data/presence';

interface PresenceValue {
   /** Actors with visible record activity, plus this viewer. */
   live: Presence[];
   byUserId: Map<string, Presence>;
   isLive: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceValue | null>(null);

/** Active record participants visible to this viewer's authorized sync groups. */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
   const { viewerId } = useWorkspace();
   const pathname = usePathname();

   const [visible, setVisible] = useState(true);
   useEffect(() => {
      const update = () => setVisible(document.visibilityState !== 'hidden');
      update();
      document.addEventListener('visibilitychange', update);
      return () => document.removeEventListener('visibilitychange', update);
   }, []);

   const route = activityFor(pathname);
   const issueId = useAblo((client) =>
      route.entityType === 'issue'
         ? client.issue.local.list({}).find((issue) => issue.identifier === route.entityId)?.id
         : undefined
   );
   const projectId = useAblo((client) =>
      route.entityType === 'project' ? client.project.local.get(route.entityId)?.id : undefined
   );
   const peers = useAblo((client) =>
      presenceForSessions(client.presence.others, (id) => client.issue.local.get(id)?.identifier)
   );

   const value = useMemo<PresenceValue>(() => {
      const live = (peers ?? []).filter((peer) => peer.userId !== viewerId);
      // The stream filters out our own echo, but the viewer is plainly here.
      live.unshift({
         userId: viewerId,
         isAgent: false,
         ...activityFor(pathname),
         lastActive: new Date().toISOString(),
      });

      const byUserId = new Map(live.map((entry) => [entry.userId, entry]));
      return { live, byUserId, isLive: (userId) => byUserId.has(userId) };
   }, [peers, viewerId, pathname]);

   return (
      <PresenceContext.Provider value={value}>
         {visible && issueId && <IssueReadPresence id={issueId} />}
         {visible && projectId && <ProjectReadPresence id={projectId} />}
         {children}
      </PresenceContext.Provider>
   );
}

function IssueReadPresence({ id }: { id: string }) {
   useRecordPresence((client) => client.issue, id);
   return null;
}

function ProjectReadPresence({ id }: { id: string }) {
   useRecordPresence((client) => client.project, id);
   return null;
}

export function usePresence(): PresenceValue {
   const value = useContext(PresenceContext);
   if (!value) throw new Error('usePresence must be used inside PresenceProvider');
   return value;
}

/** Convenience for the common question: is this one person here? */
export function useIsLive(userId: string): boolean {
   return usePresence().isLive(userId);
}

/**
 * The current route for the viewer’s own display label.
 *
 * The entity ids here are the ones in the URL — an issue identifier like
 * CORE-142 rather than its uuid — because the only consumer is another
 * person's screen, and that is the name they know it by.
 */
function activityFor(pathname: string): {
   action: string;
   entityType: string;
   entityId: string;
   detail?: string;
} {
   // Every in-app route is /{orgSlug}/…
   const [, , ...rest] = pathname.split('/');

   const [section, first, second] = rest;
   switch (section) {
      case 'issue':
         return { action: 'viewing', entityType: 'issue', entityId: first ?? '', detail: first };
      case 'project':
         return { action: 'viewing', entityType: 'project', entityId: first ?? '', detail: second };
      case 'team':
         return { action: 'viewing', entityType: 'team', entityId: first ?? '', detail: second };
      case 'profiles':
         return { action: 'viewing', entityType: 'member', entityId: first ?? '' };
      default:
         // A list or settings screen: no entity, but still worth saying where.
         return {
            action: 'viewing',
            entityType: 'view',
            entityId: section || 'home',
            detail: section,
         };
   }
}
