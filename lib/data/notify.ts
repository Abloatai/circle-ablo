'use client';

import { toast } from 'sonner';

/** Browser credentials cannot write another person's private notification stream. */
export async function notify(
   event: { type: 'comment'; commentId: string } | { type: 'assignment'; issueId: string }
): Promise<void> {
   try {
      const response = await fetch('/api/issues/notifications', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(event),
      });
      if (!response.ok) throw new Error('Notification delivery failed');
   } catch {
      toast.warning('Change saved, but notifications could not be delivered');
   }
}
