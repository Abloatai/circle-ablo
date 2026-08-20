'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Shown when the id in the URL matches no project the viewer can see.
 *
 * The route used to answer this by looking the id up in `lib/domain`, which
 * meant a project created in the app 404'd while a deleted fixture still
 * resolved. The live list is the only thing that knows.
 */
export function ProjectMissing({ projectId }: { projectId: string }) {
   const { orgId } = useParams<{ orgId: string }>();
   return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-muted-foreground">
         <p>Project {projectId} not found.</p>
         <Link href={`/${orgId}/projects`} className="underline">
            Back to projects
         </Link>
      </div>
   );
}
