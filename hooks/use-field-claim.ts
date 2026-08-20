'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAblo } from '@/lib/ablo';

type Held = { release: () => Promise<void> } & Record<string, unknown>;

/**
 * Holds a claim on one field of a row while someone is editing it.
 *
 * This is what Ablo's claims are for, and the case the rest of the app does not
 * need. A field write from a picker is decided the moment it is made — Ablo
 * merges at field level, so a person setting the status and an agent setting the
 * priority both land with no coordination at all.
 *
 * An editor is different. It reads the current text, the person types for a
 * while, and the write happens on blur. During that gap an agent can rewrite the
 * same field, and the blur would silently paste an old value over the new one.
 * `EditableTitle` even documented that: "their version wins unless this tab has
 * unsaved edits."
 *
 * So the claim is taken on focus and released on blur, and the write carries it.
 * Two consequences: the agent waits rather than writing underneath, and if the
 * row moved anyway the write is rejected instead of clobbering.
 *
 * **Fail fast rather than queue.** The default is to wait in line, which would
 * freeze a text box behind whoever holds it. If the claim cannot be had the
 * editor stays usable and `blocked` says who is busy, so the person can decide.
 */
export function useFieldClaim(model: 'issue', id: string | undefined, field: string) {
   const ablo = useAblo();
   const held = useRef<Held | null>(null);
   const [blocked, setBlocked] = useState<string | null>(null);

   const take = useCallback(
      async (description: string) => {
         if (!ablo || !id || held.current) return;
         try {
            const client = ablo as unknown as Record<string, Record<string, unknown>>;
            const claim = (await (client[model].claim as (params: unknown) => Promise<Held | null>)(
               {
                  id,
                  fields: (row: Record<string, unknown>) => row[field],
                  description,
                  // Do not wait in line: a text box that blocks on focus is worse
                  // than one that tells you someone else is in it.
                  queue: false,
               }
            )) as Held | null;
            held.current = claim;
            setBlocked(claim ? null : 'Someone else is editing this');
         } catch {
            // A claim is an improvement, not a precondition. If it cannot be
            // taken the write still happens and is judged on its own.
            held.current = null;
         }
      },
      [ablo, id, model, field]
   );

   const drop = useCallback(async () => {
      const claim = held.current;
      held.current = null;
      setBlocked(null);
      if (claim) await claim.release().catch(() => undefined);
   }, []);

   // Leaving the page mid-edit must not strand the lease for everyone else.
   useEffect(() => {
      return () => {
         void held.current?.release().catch(() => undefined);
         held.current = null;
      };
   }, []);

   return { take, drop, blocked, current: () => held.current };
}
