import { MonthlyData, TaskItem } from './types';

// Based on PDF 3 S-Curve Data
export const INITIAL_SCURVE_DATA: MonthlyData[] = [
  { month: 'Okt', plan: 18, actual: 18 },
  { month: 'Nov', plan: 35, actual: 47 },
  { month: 'Des', plan: 47, actual: 47 },
  { month: 'Jan', plan: 53, actual: 47 },
  { month: 'Feb', plan: 71, actual: 47 },
  { month: 'Mar', plan: 88, actual: 47 },
  { month: 'Apr', plan: 100, actual: 47 }, // Extrapolated end
];

// Based on PDF 1 & 2 Gantt/Table Data
export const INITIAL_TASKS: TaskItem[] = [
  {
    id: '1',
    code: 'A',
    activity: 'Administrasi Awal',
    pic: 'DANTA',
    weight: 15,
    progress: 100,
    status: 'Completed',
    startDate: '2024-10-01',
    endDate: '2024-11-15',
  },
  {
    id: '2',
    code: 'B',
    activity: 'Penanaman (Mahakam Fase-3)',
    pic: 'ARIEF',
    weight: 40,
    progress: 45,
    status: 'Delayed',
    startDate: '2024-11-01',
    endDate: '2025-02-28',
  },
  {
    id: '3',
    code: 'B.1',
    activity: 'Survey Lokasi & Pengadaan Bibit',
    pic: 'ARIEF',
    weight: 10,
    progress: 100,
    status: 'Completed',
    startDate: '2024-11-01',
    endDate: '2024-12-15',
  },
  {
    id: '4',
    code: 'B.3',
    activity: 'Penanaman Bibit',
    pic: 'TIM LAPANGAN',
    weight: 30,
    progress: 20,
    status: 'In Progress',
    startDate: '2025-01-01',
    endDate: '2025-03-30',
  },
  {
    id: '5',
    code: 'C',
    activity: 'Administrasi Penutupan',
    pic: 'INDRI',
    weight: 10,
    progress: 0,
    status: 'Not Started',
    startDate: '2025-03-01',
    endDate: '2025-04-15',
  },
  {
    id: '6',
    code: 'D',
    activity: 'Community Development',
    pic: 'BILA',
    weight: 25,
    progress: 60,
    status: 'In Progress',
    startDate: '2024-12-01',
    endDate: '2025-03-01',
  },
  {
    id: '7',
    code: 'E',
    activity: 'Monitoring Biodiversity',
    pic: 'ARIEF',
    weight: 10,
    progress: 10,
    status: 'In Progress',
    startDate: '2025-01-15',
    endDate: '2025-04-01',
  }
];

export const COLORS = {
  // Single interactive accent — Action Blue (DESIGN.md)
  action: '#0066cc',
  actionHover: '#0055b3',
  actionFocus: '#0071e3',
  actionOnDark: '#2997ff',
  actionTint: '#eff6ff',

  // Semantic status (meaning only, always paired with an icon)
  statusPositive: '#059669',
  statusWarning: '#d97706',
  statusDanger: '#dc2626',
  statusNeutral: '#475569',

  // Chart series
  chartActual: '#0066cc', // solid — the focus
  chartPlan: '#94a3b8',   // slate, dashed — the reference
  chartGrid: '#e2e8f0',
  chartAxis: '#64748b',

  // Neutrals (slate)
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate500: '#64748b',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
} as const;