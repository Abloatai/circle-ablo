'use client';

import { Box } from 'lucide-react';
import type { Project } from '@/lib/domain/projects';
import { projects as seedProjects } from '@/lib/domain/projects';

/**
 * Icons are components, so a row stores a registry key ("Cuboid") instead.
 * The registry is built from the icons the app already imports, which keeps
 * the bundle unchanged — no dynamic lookup over all of lucide.
 */
const REGISTRY = new Map<string, Project['icon']>();

for (const project of seedProjects) {
   const icon = project.icon as unknown as { displayName?: string; render?: { name?: string } };
   const key = icon?.displayName ?? icon?.render?.name;
   if (key && !REGISTRY.has(key)) REGISTRY.set(key, project.icon);
}

export function projectIcon(key: string | null | undefined): Project['icon'] {
   return (key && REGISTRY.get(key)) || (Box as Project['icon']);
}
