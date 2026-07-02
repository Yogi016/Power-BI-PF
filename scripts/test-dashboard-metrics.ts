import assert from 'node:assert';
import type { ProjectData } from '../types';
import {
  latestProgress,
  latestPlanned,
  projectVariance,
  isAtRisk,
  atRiskProjects,
  portfolioSeries,
} from '../utils/dashboardMetrics';

const wk = (weekIndex: number, baseline: number, actual: number) => ({
  week: `W${weekIndex}`,
  weekIndex,
  year: 2026,
  baseline,
  actual,
});

const onTrack: ProjectData = {
  id: 'a',
  name: 'A',
  pic: 'x',
  activities: [],
  weeklyBaseline: [wk(0, 10, 0), wk(1, 30, 0)],
  weeklyActual: [wk(0, 0, 12), wk(1, 0, 35)],
};

const behind: ProjectData = {
  id: 'b',
  name: 'B',
  pic: 'y',
  activities: [],
  weeklyBaseline: [wk(0, 10, 0), wk(1, 50, 0)],
  weeklyActual: [wk(0, 0, 8), wk(1, 0, 20)],
};

// latestProgress = last actual of weeklyActual (sorted by weekIndex)
assert.strictEqual(latestProgress(onTrack), 35);
assert.strictEqual(latestProgress(behind), 20);

// latestPlanned = last baseline of weeklyBaseline (sorted by weekIndex)
assert.strictEqual(latestPlanned(onTrack), 30);
assert.strictEqual(latestPlanned(behind), 50);

// variance = actual - planned (rounded to 1 decimal)
assert.strictEqual(projectVariance(onTrack), 5);   // 35 - 30
assert.strictEqual(projectVariance(behind), -30);  // 20 - 50

// at-risk when variance < -10
assert.strictEqual(isAtRisk(onTrack), false);
assert.strictEqual(isAtRisk(behind), true);
assert.deepStrictEqual(
  atRiskProjects([onTrack, behind]).map((p) => p.id),
  ['b'],
);

// portfolio series: per weekIndex, plan=avg(baseline across projects), actual=avg(actual across projects)
const series = portfolioSeries([onTrack, behind]);
assert.strictEqual(series.length, 2);

// weekIndex 0: plan = avg(10, 10) = 10, actual = avg(12, 8) = 10
assert.strictEqual(series[0].month, 'W0');
assert.strictEqual(series[0].plan, 10);
assert.strictEqual(series[0].actual, 10);

// weekIndex 1: plan = avg(30, 50) = 40, actual = avg(35, 20) = 27.5
assert.strictEqual(series[1].month, 'W1');
assert.strictEqual(series[1].plan, 40);
assert.strictEqual(series[1].actual, 27.5);

// Unsorted input must still yield correct latest values (sort by weekIndex)
const unsorted: ProjectData = {
  id: 'c',
  name: 'C',
  pic: 'z',
  activities: [],
  weeklyBaseline: [wk(2, 60, 0), wk(0, 10, 0)],
  weeklyActual: [wk(2, 0, 55), wk(0, 0, 5)],
};
assert.strictEqual(latestPlanned(unsorted), 60);
assert.strictEqual(latestProgress(unsorted), 55);

console.log('dashboard-metrics OK');
