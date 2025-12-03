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
  primary: '#0f172a', // Slate 900
  secondary: '#64748b', // Slate 500
  accent: '#3b82f6', // Blue 500
  success: '#22c55e', // Green 500
  warning: '#eab308', // Yellow 500
  danger: '#ef4444', // Red 500
  planLine: '#f97316', // Orange 500 (from PDF)
  actualLine: '#0ea5e9', // Sky 500 (from PDF)
};