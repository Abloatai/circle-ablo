import { notFound } from 'next/navigation';
import Reviews from '@/components/common/reviews/reviews';
import MainLayout from '@/components/layout/main-layout';
import { listCodeReviews } from '@/lib/github/reviews';
import { getViewer } from '@/lib/session';

export default async function ReviewsPage({ params }: { params: Promise<{ orgId: string }> }) {
   const [{ orgId }, viewer] = await Promise.all([params, getViewer()]);
   if (!viewer || viewer.organizationSlug !== orgId) notFound();
   const collection = await listCodeReviews(viewer, 'open');

   return (
      <MainLayout>
         <Reviews orgId={orgId} listTab="open" {...collection} />
      </MainLayout>
   );
}
