import MainLayout from '@/components/layout/main-layout';
import { notFound } from 'next/navigation';
import AccountConnections from '@/components/common/settings/account-connections';
import { INTEGRATIONS_ENABLED } from '@/lib/features';
import Header from '@/components/layout/headers/settings/header';

export default function Page() {
   // Disabling the nav entry is not enough — the URL still resolves.
   if (!INTEGRATIONS_ENABLED) notFound();

   return (
      <MainLayout header={<Header />} headersNumber={1}>
         <AccountConnections />
      </MainLayout>
   );
}
