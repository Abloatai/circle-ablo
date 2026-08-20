'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function AcceptInvitation({
   invitationId,
   organizationSlug,
}: {
   invitationId: string;
   organizationSlug: string;
}) {
   const router = useRouter();
   const [pending, setPending] = useState(false);
   const [error, setError] = useState<string | null>(null);

   async function accept() {
      setPending(true);
      setError(null);
      const { error } = await authClient.organization.acceptInvitation({ invitationId });
      if (error) {
         setPending(false);
         setError(error.message ?? 'Could not accept the invitation');
         return;
      }
      // Make the workspace they just joined the active one.
      await authClient.organization.setActive({ organizationSlug });
      router.push('/');
      router.refresh();
   }

   return (
      <div className="space-y-3">
         {error && <p className="text-sm text-destructive">{error}</p>}
         <Button className="w-full" disabled={pending} onClick={() => void accept()}>
            {pending ? 'Joining…' : 'Accept invitation'}
         </Button>
      </div>
   );
}
