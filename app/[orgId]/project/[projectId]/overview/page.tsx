import ProjectOverview from '@/components/common/projects/details/project-overview';
import Header from '@/components/layout/headers/project/header';
import MainLayout from '@/components/layout/main-layout';

interface ProjectPageProps {
   params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
   const { projectId } = await params;

   return (
      <MainLayout header={<Header projectId={projectId} />}>
         <ProjectOverview projectId={projectId} />
      </MainLayout>
   );
}
