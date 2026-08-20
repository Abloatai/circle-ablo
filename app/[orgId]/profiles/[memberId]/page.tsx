'use client';

import MemberProfile from '@/components/common/members/member-profile';
import Header from '@/components/layout/headers/profile/header';
import MainLayout from '@/components/layout/main-layout';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { notFound } from 'next/navigation';
import { use } from 'react';

interface MemberProfilePageProps {
   params: Promise<{ memberId: string }>;
}

// A client component cannot be async: `use` unwraps the params promise instead,
// so the hooks below run in a normal render.
export default function MemberProfilePage({ params }: MemberProfilePageProps) {
   const { members: users } = useWorkspace();
   const { memberId } = use(params);
   const member = users.find((user) => user.id === memberId);

   if (!member) {
      notFound();
   }

   return (
      <MainLayout header={<Header member={member} />}>
         <MemberProfile member={member} />
      </MainLayout>
   );
}
