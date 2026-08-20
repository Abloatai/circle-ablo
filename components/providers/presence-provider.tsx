'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { usePeers } from '@abloatai/humans/react';
import { ablo } from '@/lib/ablo';
import { useWorkspace } from '@/components/providers/workspace-provider';

/** One person (or agent) currently connected to the workspace. */
export interface Presence {
   userId: string;
   isAgent: boolean;
   /** 'viewing', 'editing', 'idle', … — free-form, see `activityFor`. */
   action: string;
   /** What they are on: 'issue', 'project', 'team', 'view', … */
   entityType: string;
   entityId: string;
   /** Human-readable: "CORE-142", "Members". */
   detail?: string;
   /** ISO timestamp of their last frame. */
   lastActive: string;
}

interface PresenceValue {
   /** Everyone connected right now, the viewer included. */
   live: Presence[];
   byUserId: Map<string, Presence>;
   isLive: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceValue | null>(null);

/**
 * Who is live in the workspace.
 *
 * This is Ablo's presence stream, not a database column: presence is
 * ephemeral, and a row that says "online" outlives the tab that set it — the
 * `user.status` column could only ever be a guess, and was always a stale one
 * after a crash or a closed laptop. The stream is authoritative instead,
 * because the server drops a participant when its socket goes.
 *
 * It costs no extra connection: presence frames ride the same WebSocket the
 * issues already sync over.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
   const { viewerId } = useWorkspace();
   const pathname = usePathname();

   // No scope: everyone on the viewer's own sync groups, which is their
   // organization and their teams — so, the workspace.
   const peers = usePeers();

   // Tell the workspace what this tab is looking at, and take it back when the
   // tab is hidden: a backgrounded tab is still connected but nobody is there.
   useEffect(() => {
      const announce = () => {
         if (document.visibilityState === 'hidden') {
            ablo.presence.idle();
            return;
         }
         const activity = activityFor(pathname);
         ablo.presence.update(activity);
      };

      announce();
      document.addEventListener('visibilitychange', announce);
      return () => document.removeEventListener('visibilitychange', announce);
   }, [pathname]);

   const value = useMemo<PresenceValue>(() => {
      const live: Presence[] = peers.map((peer) => ({
         userId: peer.participantId,
         isAgent: peer.participantKind === 'agent',
         action: peer.activity.action,
         entityType: peer.activity.entityType,
         entityId: peer.activity.entityId,
         detail: peer.activity.detail,
         lastActive: peer.lastActive,
      }));

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

   return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
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
 * The current route as an activity peers can read.
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
