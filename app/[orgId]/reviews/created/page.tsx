import { notFound } from 'next/navigation';
import Reviews from '@/components/common/reviews/reviews';
import MainLayout from '@/components/layout/main-layout';
import { listCodeReviews } from '@/lib/github/reviews';
import { getViewer } from '@/lib/session';

export default async function CreatedReviewsPage({
   params,
}: {
   params: Promise<{ orgId: string }>;
}) {
   const [{ orgId }, viewer] = await Promise.all([params, getViewer()]);
   if (!viewer || viewer.organizationSlug !== orgId) notFound();
   const collection = await listCodeReviews(viewer, 'completed');

   return (
      <MainLayout>
         <Reviews orgId={orgId} listTab="completed" {...collection} />
      </MainLayout>
   );
}
