// =====================================================
// CORE INTERFACES
// =====================================================

// Project interface - Main project information
export interface Project {
  id: string;
  name: string;
  pic: string; // Person In Charge
  description?: string; // Uraian Kegiatan/Program
  category?: string;
  location?: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status: 'active' | 'completed' | 'on-hold' | 'cancelled';
  budget?: number;
  createdAt?: string;
  updatedAt?: string;
}

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
  DASHBOARD = 'dashboard',
  MANAGE_DATA = 'manage_data',
  WEEKLY_PROGRESS = 'weekly_progress',
  GANTT = 'gantt',
  CALENDAR = 'calendar',
}

export interface ProjectFilterState {
  options: string[];
  selected: string | null;
}

// S-Curve data point untuk chart
export interface SCurveDataPoint {
  periodLabel: string; // "Jan 2025" atau "Juni-1"
  periodIndex: number;
  year: number;
  baseline: number; // Cumulative baseline %
  actual: number; // Cumulative actual %
  periodBaseline?: number; // Baseline untuk periode ini saja
  periodActual?: number; // Actual untuk periode ini saja
  variance?: number; // actual - baseline
}

// Project metrics untuk dashboard
export interface ProjectMetrics {
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  delayedActivities: number;
  overallProgress: number; // %
  plannedProgress: number; // %
  variance: number; // actual - planned
  daysRemaining: number;
  completionRate: number; // %
}

// Activity status type
export type ActivityStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed';

// Period type for timeline
export type PeriodType = 'weekly' | 'monthly' | 'yearly';

// Calendar Types
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    activityId: string;
    projectId: string;
    projectName: string;
    status: string;
    pic: string;
    code: string;
    weight: number;
  };
}

export enum CalendarViewMode {
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day',
}
