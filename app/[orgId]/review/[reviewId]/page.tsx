import { notFound } from 'next/navigation';
import Reviews from '@/components/common/reviews/reviews';
import { REVIEWS_ENABLED } from '@/lib/features';
import MainLayout from '@/components/layout/main-layout';

export default async function ReviewOverviewPage({
   params,
}: {
   params: Promise<{ reviewId: string }>;
}) {
   // Disabling the sidebar link is not enough — the URL still resolves.
   if (!REVIEWS_ENABLED) notFound();

   const { reviewId } = await params;
   return (
      <MainLayout>
         <Reviews selectedReviewId={reviewId} section="overview" />
      </MainLayout>
   );
}
