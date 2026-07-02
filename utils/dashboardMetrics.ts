import type { ProjectData, WeeklyData, MonthlyData } from '../types';

const sortedByWeek = (series: WeeklyData[]): WeeklyData[] =>
  [...series].sort((a, b) => a.weekIndex - b.weekIndex);

/** Latest cumulative ACTUAL progress (%). */
export const latestProgress = (p: ProjectData): number => {
  const s = sortedByWeek(p.weeklyActual);
  return s.length ? s[s.length - 1].actual : 0;
};

/** Latest cumulative PLANNED progress (%) — lives in WeeklyData.baseline. */
export const latestPlanned = (p: ProjectData): number => {
  const s = sortedByWeek(p.weeklyBaseline);
  return s.length ? s[s.length - 1].baseline : 0;
};

export const projectVariance = (p: ProjectData): number =>
  Math.round((latestProgress(p) - latestPlanned(p)) * 10) / 10;

export const AT_RISK_THRESHOLD = -10;
export const isAtRisk = (p: ProjectData): boolean => projectVariance(p) < AT_RISK_THRESHOLD;

export const atRiskProjects = (projects: ProjectData[]): ProjectData[] =>
  projects.filter(isAtRisk);

/** Average baseline/actual across all projects per weekIndex → MonthlyData[] for SCurveChart. */
export const portfolioSeries = (projects: ProjectData[]): MonthlyData[] => {
  const byIndex = new Map<number, { label: string; plan: number[]; actual: number[] }>();
  for (const p of projects) {
    for (const w of p.weeklyBaseline) {
      const e = byIndex.get(w.weekIndex) ?? { label: w.week, plan: [], actual: [] };
      e.plan.push(w.baseline);
      byIndex.set(w.weekIndex, e);
    }
    for (const w of p.weeklyActual) {
      const e = byIndex.get(w.weekIndex) ?? { label: w.week, plan: [], actual: [] };
      e.actual.push(w.actual);
      byIndex.set(w.weekIndex, e);
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, e]) => ({ month: e.label, plan: avg(e.plan), actual: avg(e.actual) }));
};
