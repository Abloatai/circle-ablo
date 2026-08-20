'use client';

import { AbloProvider, ablo } from '@/lib/ablo';

export function Providers({
   children,
   userId,
}: {
   children: React.ReactNode;
   /** Resolved server-side from Better Auth; not the security boundary. */
   userId: string;
}) {
   return (
      <AbloProvider client={ablo} userId={userId}>
         {children}
      </AbloProvider>
   );
}
