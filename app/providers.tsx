'use client';

import { AbloProvider, ablo } from '@/lib/ablo';

export function Providers({ children }: { children: React.ReactNode }) {
   return <AbloProvider client={ablo}>{children}</AbloProvider>;
}
