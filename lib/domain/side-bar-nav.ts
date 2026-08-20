import {
   Bot,
   GitPullRequestArrow,
   Inbox,
   FolderKanban,
   Box,
   Settings,
   Bell,
   KeyRound,
   Users,
   Tag,
   Layers,
   FileText,
   MessageSquare,
   Clock,
   Zap,
   UserRound,
} from 'lucide-react';

/**
 * The personal section of the sidebar.
 *
 * `url` is the path **under** `/{orgId}`, the way `WORKSPACE_NAV` in
 * `nav-workspace.tsx` already spells it. These used to carry a workspace slug
 * baked in, so every one of them navigated to a fixed workspace rather than the
 * one you are signed in to.
 */
export const inboxItems = [
   {
      name: 'Inbox',
      url: '/inbox',
      icon: Inbox,
   },
   {
      name: 'Reviews',
      url: '/reviews',
      icon: GitPullRequestArrow,
   },
   {
      name: 'My issues',
      url: '/my-issues',
      icon: FolderKanban,
   },
   {
      name: 'Agent',
      url: '/agent',
      icon: Bot,
   },
];

export const accountItems = [
   {
      name: 'Account',
      url: '/settings/account',
      icon: UserRound,
   },
   {
      name: 'Preferences',
      url: '/settings/preferences',
      icon: Settings,
   },
   {
      name: 'Profile',
      url: '/settings/profile',
      icon: UserRound,
   },
   {
      name: 'Notifications',
      url: '/settings/notifications',
      icon: Bell,
   },
   {
      name: 'Security & access',
      url: '/settings/security',
      icon: KeyRound,
   },
   {
      name: 'Connected accounts',
      url: '/settings/connected-accounts',
      icon: Users,
   },
];

export const featuresItems = [
   {
      name: 'Labels',
      url: '/settings/labels',
      icon: Tag,
   },
   {
      name: 'Projects',
      url: '/settings/projects',
      icon: Box,
   },
   {
      name: 'Initiatives',
      url: '/settings/initiatives',
      icon: Layers,
   },
   {
      name: 'Customer requests',
      url: '/settings/customer-requests',
      icon: Inbox,
   },
   {
      name: 'Templates',
      url: '/settings/templates',
      icon: FileText,
   },
   {
      name: 'Asks',
      url: '/settings/asks',
      icon: MessageSquare,
   },
   {
      name: 'SLAs',
      url: '/settings/slas',
      icon: Clock,
   },
   {
      name: 'Emojis',
      url: '/settings/emojis',
      icon: MessageSquare,
   },
   {
      name: 'Integrations',
      url: '/settings/integrations',
      icon: Zap,
   },
];
