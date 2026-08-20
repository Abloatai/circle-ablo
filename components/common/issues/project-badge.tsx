'use client';

import { Badge } from '@/components/ui/badge';
import { Project } from '@/lib/domain/projects';
import Link from 'next/link';
import { useWorkspace } from '@/components/providers/workspace-provider';

/**
 * The project an issue belongs to.
 *
 * It links to that project. It used to link to a hardcoded workspace slug and
 * to the projects list, rather than to the thing the badge actually names.
 */
export function ProjectBadge({ project }: { project: Project }) {
   const { organizationSlug } = useWorkspace();

   return (
      <Link
         href={`/${organizationSlug}/project/${project.id}/overview`}
         className="flex items-center justify-center gap-.5"
      >
         <Badge
            variant="outline"
            className="gap-1.5 rounded-full text-muted-foreground bg-background"
         >
            <project.icon size={16} />
            {project.name}
         </Badge>
      </Link>
   );
}
