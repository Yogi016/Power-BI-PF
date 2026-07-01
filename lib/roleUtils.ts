import type { User } from '@supabase/supabase-js';
import type { RoleProfile, UserProfile, UserRole } from '../types';

export const ROLE_PROFILES: Record<UserRole, RoleProfile> = {
  vp_lingkungan: {
    role: 'vp_lingkungan',
    label: 'VP Lingkungan',
    shortLabel: 'VP',
    description: 'Executive approval, dokumen strategis, dan pemantauan risiko lintas portfolio.',
  },
  project_manager: {
    role: 'project_manager',
    label: 'Project Manager',
    shortLabel: 'PM',
    description: 'Validasi portfolio, kelengkapan dokumen, dan bottleneck lintas Project Head.',
  },
  project_head: {
    role: 'project_head',
    label: 'Project Head',
    shortLabel: 'PH',
    description: 'Review substansi program, evidence project, dan tindak lanjut implementasi.',
  },
  staff_officer: {
    role: 'staff_officer',
    label: 'Staff Officer',
    shortLabel: 'Staff',
    description: 'Draft dokumen, upload versi, metadata, dan update evidence operasional.',
  },
};

const ROLE_ALIASES: Record<string, UserRole> = {
  vp: 'vp_lingkungan',
  'vp lingkungan': 'vp_lingkungan',
  vp_lingkungan: 'vp_lingkungan',
  vice_president_lingkungan: 'vp_lingkungan',
  project_manager: 'project_manager',
  'project manager': 'project_manager',
  pm: 'project_manager',
  project_head: 'project_head',
  'project head': 'project_head',
  ph: 'project_head',
  staff: 'staff_officer',
  staff_officer: 'staff_officer',
  'staff officer': 'staff_officer',
  officer: 'staff_officer',
};

export function normalizeUserRole(value?: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, '_');
  return ROLE_ALIASES[normalized] || ROLE_ALIASES[normalized.replace(/_/g, ' ')] || null;
}

export function resolveUserRole(user: User | null, profile?: UserProfile | null): UserRole {
  if (profile?.isActive) {
    const profileRole = normalizeUserRole(profile.roleCode);
    if (profileRole) return profileRole;
  }

  const metadata = user?.user_metadata || {};
  const candidates = [
    metadata.role,
    metadata.app_role,
    metadata.position,
    metadata.jabatan,
    metadata.title,
  ];

  for (const candidate of candidates) {
    const role = normalizeUserRole(candidate);
    if (role) return role;
  }

  const email = user?.email?.toLowerCase() || '';
  if (email.includes('vp')) return 'vp_lingkungan';
  if (email.includes('manager') || email.includes('.pm') || email.includes('pm.')) return 'project_manager';
  if (email.includes('head') || email.includes('.ph') || email.includes('ph.')) return 'project_head';

  return 'staff_officer';
}

export function getRoleProfile(role: UserRole): RoleProfile {
  return ROLE_PROFILES[role];
}
