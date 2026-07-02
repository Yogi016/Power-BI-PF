import type { UserRole } from '../types';
import { normalizeUserRole } from './roleUtils';

// DEV ONLY: allows previewing each role dashboard via ?role=vp|pm|ph|staff.
// Guarded by import.meta.env.DEV so it is a no-op in production builds.
export function getDevRoleOverride(): UserRole | null {
  if (!import.meta.env.DEV) return null;
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('role');
  return raw ? normalizeUserRole(raw) : null;
}
