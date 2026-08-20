'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

/**
 * The team's description, edited in place.
 *
 * It used to be the literal string "Add a description…" — an invitation with
 * nothing behind it. Teams are Better Auth's, so this saves through the team
 * route rather than Ablo, and refreshes because teams are loaded on the server.
 */
export function TeamDescription({ teamId, initial }: { teamId: string; initial: string }) {
   const router = useRouter();
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState(initial);
   const [saving, setSaving] = useState(false);

   useEffect(() => setDraft(initial), [initial]);

   async function save() {
      setEditing(false);
      if (draft.trim() === initial.trim()) return;
      setSaving(true);
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ description: draft }),
      });
      setSaving(false);
      if (!response.ok) {
         setDraft(initial);
         const body = (await response.json().catch(() => ({}))) as { error?: string };
         toast.error('Could not save the description', { description: body.error });
         return;
      }
      router.refresh();
   }

   if (editing) {
      return (
         <Textarea
            autoFocus
            aria-label="Team description"
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={(event) => {
               if (event.key === 'Escape') {
                  setDraft(initial);
                  setEditing(false);
               }
            }}
            placeholder="What this team works on"
            className="mt-4 min-h-20"
         />
      );
   }

   return (
      <button
         type="button"
         onClick={() => setEditing(true)}
         className="mt-4 block w-full text-left text-muted-foreground hover:text-foreground"
      >
         {initial || 'Add a description…'}
      </button>
   );
}
