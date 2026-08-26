import { notFound } from 'next/navigation';
import Reviews from '@/components/common/reviews/reviews';
import MainLayout from '@/components/layout/main-layout';
import { getCodeReview, listCodeReviews } from '@/lib/github/reviews';
import { getViewer } from '@/lib/session';

export default async function ReviewOverviewPage({
   params,
}: {
   params: Promise<{ orgId: string; reviewId: string }>;
}) {
   const [{ orgId, reviewId }, viewer] = await Promise.all([params, getViewer()]);
   if (!viewer || viewer.organizationSlug !== orgId) notFound();
   const [collection, selectedReview] = await Promise.all([
      listCodeReviews(viewer, 'all'),
      getCodeReview(viewer, reviewId),
   ]);
   if (!selectedReview) notFound();
   const listTab =
      selectedReview.status === 'open' || selectedReview.status === 'draft'
         ? ('open' as const)
         : ('completed' as const);
   return (
      <MainLayout>
         <Reviews
            orgId={orgId}
            listTab={listTab}
            selectedReview={selectedReview}
            section="overview"
            {...collection}
         />
      </MainLayout>
   );
}
