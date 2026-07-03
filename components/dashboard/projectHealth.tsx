import type { Status } from '../ui';
import type { ProjectHealth } from '../../utils/dashboardMetrics';
import type { ActivityStatus } from '../../types';

export const HEALTH_BADGE: Record<ProjectHealth, { status: Status; label: string }> = {
  'on-track': { status: 'positive', label: 'On-track' },
  behind: { status: 'warning', label: 'Tertinggal' },
  'at-risk': { status: 'danger', label: 'Berisiko' },
  'not-started': { status: 'neutral', label: 'Belum mulai' },
};

export const ACTIVITY_BADGE: Record<ActivityStatus, { status: Status; label: string }> = {
  completed: { status: 'positive', label: 'Selesai' },
  'in-progress': { status: 'neutral', label: 'Diproses' },
  delayed: { status: 'danger', label: 'Terlambat' },
  'not-started': { status: 'neutral', label: 'Belum mulai' },
};
