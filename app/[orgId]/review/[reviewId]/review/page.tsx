import { redirect } from 'next/navigation';

export default async function ReviewGuidePage({
   params,
}: {
   params: Promise<{ orgId: string; reviewId: string }>;
}) {
   const { orgId, reviewId } = await params;
   redirect(`/${orgId}/review/${reviewId}`);
}
