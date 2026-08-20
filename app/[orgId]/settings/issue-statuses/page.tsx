import MainLayout from '@/components/layout/main-layout';
import IssueStatusesSettings from '@/components/common/settings/issue-statuses-settings';
import Header from '@/components/layout/headers/settings/header';

export default function Page() {
   return (
      <MainLayout header={<Header />} headersNumber={1}>
         <IssueStatusesSettings />
      </MainLayout>
   );
}
