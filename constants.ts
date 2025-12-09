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
  // Primary colors - Deep blue theme
  primary: '#1e40af', // Blue 800
  primaryLight: '#3b82f6', // Blue 500
  primaryDark: '#1e3a8a', // Blue 900
  
  // Secondary colors - Emerald green
  secondary: '#059669', // Emerald 600
  secondaryLight: '#10b981', // Emerald 500
  secondaryDark: '#047857', // Emerald 700
  
  // Accent colors
  accent: '#f59e0b', // Amber 500
  accentLight: '#fbbf24', // Amber 400
  
  // Status colors
  success: '#10b981', // Emerald 500
  warning: '#f59e0b', // Amber 500
  danger: '#ef4444', // Red 500
  info: '#3b82f6', // Blue 500
  
  // Chart colors
  planLine: '#f97316', // Orange 500 (baseline)
  actualLine: '#0ea5e9', // Sky 500 (actual)
  targetBar: '#c084fc', // Purple 400 (weekly target)
  
  // Neutral colors
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate500: '#64748b',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  
  // Gradients
  gradientPrimary: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
  gradientSecondary: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  gradientAccent: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  
  // Background
  bgLight: '#ffffff',
  bgGray: '#f8fafc',
  bgDark: '#0f172a',
};