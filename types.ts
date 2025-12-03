export interface MonthlyData {
  month: string;
  plan: number;
  actual: number;
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