import type { Initiative } from '@/lib/domain/initiatives';
import type { Project } from '@/lib/domain/projects';

/**
 * The projects in an initiative, resolved against a live project list.
 *
 * The fixture versions of these closed over `lib/domain/projects`, which is why
 * every view that used them showed the seed rather than the workspace. They
 * take the list now, and the caller gets it from `useProjects()`.
 */
export function initiativeProjects(initiative: Initiative, projects: Project[]): Project[] {
   const byId = new Map(projects.map((project) => [project.id, project]));
   return initiative.projectIds
      .map((id) => byId.get(id))
      .filter((project): project is Project => Boolean(project));
}

/** Projects considered "completed" for the n / m counter. */
export function completedProjectCount(initiative: Initiative, projects: Project[]): number {
   return initiativeProjects(initiative, projects).filter(
      (project) => project.status.category === 'completed' || project.percentComplete >= 100
   ).length;
}
