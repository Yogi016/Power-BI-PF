// Legacy interface untuk backward compatibility
export interface MonthlyData {
  month: string;
  plan: number;
  actual: number;
}

// Data mingguan untuk S-Curve
export interface WeeklyData {
  week: string; // Format: "Juni-1", "Juni-2", etc.
  weekIndex: number; // 0-39 untuk 40 minggu
  year: number; // Tahun dari minggu tersebut
  baseline: number; // Baseline Scurve (%)
  actual: number; // Kumulatif Realisasi (%)
  weeklyBaseline?: number; // Beban Tiap Minggu Baseline
  weeklyActual?: number; // Realisasi Tiap Minggu
}

// Data aktivitas dari CSV
export interface ActivityData {
  pic: string;
  project: string;
  category?: string;
  subCategory?: string;
  activity: string;
  weeklyProgress: Record<string, number>; // Key: "Juni-1", Value: percentage
  startWeek?: number;
  endWeek?: number;
}

// Data proyek
export interface ProjectData {
  id: string;
  name: string;
  pic: string;
  activities: ActivityData[];
  weeklyBaseline: WeeklyData[];
  weeklyActual: WeeklyData[];
}

export interface TaskItem {
  id: string;
  code: string;
  activity: string;
  pic: string;
  weight: number; // Percentage weight in project
  progress: number; // Current progress percentage
  status: 'Completed' | 'In Progress' | 'Delayed' | 'Not Started';
  startDate: string;
  endDate: string;
  projectId?: string; // Link ke project jika ada
  startYear?: number;
  startMonth?: string;
  startWeek?: number; // 1-4
}

export interface KPIMetric {
  label: string;
  value: string | number;
  change: number; // + or - percentage
  type: 'neutral' | 'positive' | 'negative';
}

export enum PageView {
  DASHBOARD = 'DASHBOARD',
  MANAGE_DATA = 'MANAGE_DATA'
}

export interface ProjectFilterState {
  options: string[];
  selected: string | null;
}
