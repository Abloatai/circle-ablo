import { notFound } from 'next/navigation';
import Integrations from '@/components/common/settings/integrations';
import { INTEGRATIONS_ENABLED } from '@/lib/features';
import Header from '@/components/layout/headers/settings/header';
import MainLayout from '@/components/layout/main-layout';

export default function IntegrationsSettingsPage() {
   // Disabling the nav entry is not enough — the URL still resolves.
   if (!INTEGRATIONS_ENABLED) notFound();

   return (
      <MainLayout header={<Header />} headersNumber={1}>
         <Integrations />
      </MainLayout>
   );
}
