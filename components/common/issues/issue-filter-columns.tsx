'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createColumnConfigHelper } from '@/components/data-table-filter/core/filters';
import type { ColumnOption, FiltersState } from '@/components/data-table-filter/core/types';
import { multiOptionFilterFn, optionFilterFn } from '@/components/data-table-filter/lib/filter-fns';
import { cycleStatusLabel } from '@/lib/domain/cycles';
import { Issue } from '@/lib/domain/issues';

import { priorities } from '@/lib/domain/priorities';
import type { Status, StatusCategory } from '@/lib/domain/status';
import type { Cycle } from '@/lib/domain/cycles';
import type { LabelInterface } from '@/lib/domain/labels';
import type { Project } from '@/lib/domain/projects';
import type { User } from '@/lib/domain/users';
import { useCycles, useLabels, useProjects, useStatuses } from '@/hooks/use-workspace-data';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useMemo } from 'react';

import {
   BarChart3,
   CircleCheck,
   CircleDashed,
   CircleUserRound,
   Folder,
   RefreshCcw,
   Tag,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                Option lists                                */
/* -------------------------------------------------------------------------- */

const buildStatusOptions = (status: Status[]): ColumnOption[] =>
   status.map((item) => ({
      value: item.id,
      label: item.name,
      icon: <item.icon />,
   }));

const STATUS_TYPES: { id: StatusCategory; name: string }[] = [
   { id: 'triage', name: 'Triage' },
   { id: 'backlog', name: 'Backlog' },
   { id: 'unstarted', name: 'Unstarted' },
   { id: 'started', name: 'Started' },
   { id: 'completed', name: 'Completed' },
   { id: 'canceled', name: 'Canceled' },
];

const statusTypeOptions: ColumnOption[] = STATUS_TYPES.map((item) => ({
   value: item.id,
   label: item.name,
   icon: <CircleDashed className="size-4 text-muted-foreground" />,
}));

const buildAssigneeOptions = (users: User[]): ColumnOption[] => [
   {
      value: 'unassigned',
      label: 'Unassigned',
      icon: <CircleUserRound className="size-4 text-muted-foreground" />,
   },
   ...users.map((user) => ({
      value: user.id,
      label: user.name,
      icon: (
         <Avatar className="size-4">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback>{user.name[0]}</AvatarFallback>
         </Avatar>
      ),
   })),
];

const priorityOptions: ColumnOption[] = priorities.map((priority) => ({
   value: priority.id,
   label: priority.name,
   icon: <priority.icon className="size-4 text-muted-foreground" />,
}));

const buildLabelOptions = (labels: LabelInterface[]): ColumnOption[] =>
   labels.map((label) => ({
      value: label.id,
      label: label.name,
      icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: label.color }} />,
   }));

const buildProjectOptions = (projects: Project[]): ColumnOption[] =>
   projects.map((project) => ({
      value: project.id,
      label: project.name,
      icon: <project.icon className="size-4 text-muted-foreground" />,
   }));

const buildCycleOptions = (cycles: Cycle[]): ColumnOption[] => [
   {
      value: 'no-cycle',
      label: 'No cycle',
      icon: <RefreshCcw className="size-4 text-muted-foreground" />,
   },
   ...cycles.map((cycle) => ({
      value: cycle.id,
      label: `${cycle.name} (${cycleStatusLabel[cycle.status]})`,
      icon: <RefreshCcw className="size-4 text-muted-foreground" />,
   })),
];

/* -------------------------------------------------------------------------- */
/*                              Column definitions                            */
/* -------------------------------------------------------------------------- */

const dtf = createColumnConfigHelper<Issue>();

/**
 * Filterable issue columns for the bazza/ui data-table-filter component.
 * Accessors return the raw values the filter functions compare against.
 */
/**
 * Filterable issue columns for the bazza/ui data-table-filter component.
 *
 * A hook rather than a constant: the options are the workspace's own statuses,
 * people, labels, projects and cycles, so they are only knowable once the data
 * has synced.
 */
export function useIssueFilterColumns() {
   const statuses = useStatuses();
   const labels = useLabels();
   const projects = useProjects();
   const cycles = useCycles();
   const { members } = useWorkspace();

   return useMemo(
      () => buildIssueFilterColumns({ statuses, labels, projects, cycles, members }),
      [statuses, labels, projects, cycles, members]
   );
}

function buildIssueFilterColumns({
   statuses,
   labels,
   projects,
   cycles,
   members,
}: {
   statuses: Status[];
   labels: LabelInterface[];
   projects: Project[];
   cycles: Cycle[];
   members: User[];
}) {
   const statusOptions = buildStatusOptions(statuses);
   const labelOptions = buildLabelOptions(labels);
   const projectOptions = buildProjectOptions(projects);
   const cycleOptions = buildCycleOptions(cycles);
   const assigneeOptions = buildAssigneeOptions(members);

   return [
      dtf
         .option()
         .id('status')
         .accessor((issue: Issue) => issue.status.id)
         .displayName('Status')
         .icon(CircleCheck)
         .options(statusOptions)
         .build(),
      dtf
         .option()
         .id('statusType')
         .accessor((issue: Issue) => issue.status.category)
         .displayName('Status type')
         .icon(CircleDashed)
         .options(statusTypeOptions)
         .build(),
      dtf
         .option()
         .id('assignee')
         .accessor((issue: Issue) => issue.assignee?.id ?? 'unassigned')
         .displayName('Assignee')
         .icon(CircleUserRound)
         .options(assigneeOptions)
         .build(),
      dtf
         .option()
         .id('priority')
         .accessor((issue: Issue) => issue.priority.id)
         .displayName('Priority')
         .icon(BarChart3)
         .options(priorityOptions)
         .build(),
      dtf
         .multiOption()
         .id('labels')
         .accessor((issue: Issue) => issue.labels.map((label) => label.id))
         .displayName('Labels')
         .icon(Tag)
         .options(labelOptions)
         .build(),
      dtf
         .option()
         .id('project')
         .accessor((issue: Issue) => issue.project?.id ?? '')
         .displayName('Project')
         .icon(Folder)
         .options(projectOptions)
         .build(),
      dtf
         .option()
         .id('cycle')
         .accessor((issue: Issue) => (issue.cycleId === '' ? 'no-cycle' : issue.cycleId))
         .displayName('Cycle')
         .icon(RefreshCcw)
         .options(cycleOptions)
         .build(),
   ] as const;
}

/**
 * The filter functions only need each column's id and accessor, and those do
 * not depend on the workspace's data — so applying a filter stays a plain
 * function that any code path can call.
 */
const accessorById = new Map<string, (issue: Issue) => unknown>([
   ['status', (issue) => issue.status.id],
   ['statusType', (issue) => issue.status.category],
   ['assignee', (issue) => issue.assignee?.id ?? 'unassigned'],
   ['priority', (issue) => issue.priority.id],
   ['labels', (issue) => issue.labels.map((label) => label.id)],
   ['project', (issue) => issue.project?.id ?? 'no-project'],
   ['cycle', (issue) => (issue.cycleId === '' ? 'no-cycle' : issue.cycleId)],
]);

/**
 * Applies a bazza/ui FiltersState to a list of issues, honoring the
 * operator of each filter (is / is not / include / exclude / …).
 */
export function applyIssueFilters<T extends Issue>(issues: T[], filters: FiltersState): T[] {
   if (filters.length === 0) return issues;

   return issues.filter((issue) =>
      filters.every((filter) => {
         const accessor = accessorById.get(filter.columnId);
         if (!accessor) return true;

         const value = accessor(issue);
         switch (filter.type) {
            case 'option':
               return optionFilterFn(String(value ?? ''), filter) ?? true;
            case 'multiOption':
               return multiOptionFilterFn((value as string[]) ?? [], filter) ?? true;
            default:
               return true;
         }
      })
   );
}
