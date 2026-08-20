import { InviteMember } from '@/components/common/members/invite-member';
import { LiveMembers } from '@/components/common/members/presence';
import HeaderNav from './header-nav';
import HeaderOptions from './header-options';

export default function Header() {
   return (
      <div className="w-full flex flex-col items-center">
         <div className="w-full flex items-center justify-between pr-6">
            <HeaderNav />
            <div className="flex items-center gap-3">
               <LiveMembers />
               <InviteMember />
            </div>
         </div>
         <HeaderOptions />
      </div>
   );
}
