'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

/**
 * One editable field on the profile page, saved on blur.
 *
 * These were `defaultValue` inputs with no handler: you could type into them,
 * tab away, and lose it on the next load — the "looks like it worked" failure
 * the rest of this codebase is built to avoid.
 *
 * Identity is Better Auth's, so this writes through `updateUser` rather than
 * Ablo. `router.refresh()` afterwards because members are loaded on the server
 * and handed down by the workspace provider; without it the new value would sit
 * in this input and nowhere else.
 */
export function ProfileField({
   field,
   label,
   initial,
   placeholder,
}: {
   field: 'name' | 'title';
   label: string;
   initial: string;
   placeholder?: string;
}) {
   const router = useRouter();
   const [draft, setDraft] = useState(initial);
   const [saving, setSaving] = useState(false);

   // Track the server's value when it changes underneath us.
   useEffect(() => setDraft(initial), [initial]);

   async function save() {
      const next = draft.trim();
      if (next === initial.trim()) return;
      if (field === 'name' && !next) {
         setDraft(initial); // A person must have a name; silently restore.
         return;
      }
      setSaving(true);
      const { error } = await authClient.updateUser({ [field]: next });
      setSaving(false);
      if (error) {
         setDraft(initial);
         toast.error(`Could not save your ${label.toLowerCase()}`, {
            description: error.message,
         });
         return;
      }
      toast.success(`${label} saved`);
      router.refresh();
   }

   return (
      <Input
         aria-label={label}
         value={draft}
         placeholder={placeholder}
         disabled={saving}
         onChange={(event) => setDraft(event.target.value)}
         onBlur={() => void save()}
         onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
               setDraft(initial);
               event.currentTarget.blur();
            }
         }}
         className="h-8 w-44"
      />
   );
}
