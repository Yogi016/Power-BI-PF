import type { ProjectData, UserRole } from '../types';

const SCOPED_ROLES: UserRole[] = ['staff_officer', 'project_head'];

export function scopeProjectsForRole(
  projects: ProjectData[],
  role: UserRole,
  assignedProjectIds: string[],
  supabaseLoaded: boolean
): ProjectData[] {
  const shouldScope =
    SCOPED_ROLES.includes(role) && assignedProjectIds.length > 0 && supabaseLoaded;
  if (!shouldScope) return projects;
  return projects.filter((project) => assignedProjectIds.includes(project.id));
}
