import { notFound } from 'next/navigation';
import Reviews from '@/components/common/reviews/reviews';
import { REVIEWS_ENABLED } from '@/lib/features';
import MainLayout from '@/components/layout/main-layout';

export default function CreatedReviewsPage() {
   // Disabling the sidebar link is not enough — the URL still resolves.
   if (!REVIEWS_ENABLED) notFound();

   return (
      <MainLayout>
         <Reviews listTab="created" />
      </MainLayout>
   );
}
