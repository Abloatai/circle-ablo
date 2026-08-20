import AllIssues from '@/components/common/issues/all-issues';
import Header from '@/components/layout/headers/issues/header';
import MainLayout from '@/components/layout/main-layout';

export default async function ActiveIssuesPage({
   params,
}: {
   params: Promise<{ teamId: string }>;
}) {
   const { teamId } = await params;

   return (
      <MainLayout header={<Header />}>
         <AllIssues teamKey={teamId} categories={['unstarted', 'started']} />
      </MainLayout>
   );
}
