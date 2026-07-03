import assert from 'node:assert';
import type { ProjectData } from '../types';
import {
  latestProgress,
  latestPlanned,
  projectVariance,
  isAtRisk,
  atRiskProjects,
  portfolioSeries,
  hasActualData,
  projectHealth,
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

// Mismatched week-indices: baseline spans weeks 0-2, actual only reaches week 1.
// The missing series at a weekIndex must be null (not 0), so the plan line spans
// the full timeline while actual stops at the last real actual week — no zero-dip.
const partial: ProjectData = {
  id: 'd',
  name: 'D',
  pic: 'w',
  activities: [],
  weeklyBaseline: [wk(0, 10, 0), wk(1, 40, 0), wk(2, 70, 0)],
  weeklyActual: [wk(0, 0, 8), wk(1, 0, 25)],
};
const partialSeries = portfolioSeries([partial]);
assert.strictEqual(partialSeries.length, 3);

// weeks 0 and 1 have both series
assert.strictEqual(partialSeries[0].plan, 10);
assert.strictEqual(partialSeries[0].actual, 8);
assert.strictEqual(partialSeries[1].plan, 40);
assert.strictEqual(partialSeries[1].actual, 25);

// week 2: plan present, actual has no data → null (not 0)
assert.strictEqual(partialSeries[2].plan, 70);
assert.strictEqual(partialSeries[2].actual, null);

// A weekIndex where only actual exists (plan absent) → plan is null (no phantom plan=0)
const actualAhead: ProjectData = {
  id: 'e',
  name: 'E',
  pic: 'v',
  activities: [],
  weeklyBaseline: [wk(0, 10, 0)],
  weeklyActual: [wk(0, 0, 9), wk(1, 0, 18)],
};
const aheadSeries = portfolioSeries([actualAhead]);
assert.strictEqual(aheadSeries.length, 2);
assert.strictEqual(aheadSeries[1].plan, null);
assert.strictEqual(aheadSeries[1].actual, 18);

// ── Health model (4-state) ──────────────────────────────────────────
// not-started = no actual data (all actuals 0 / empty)
const notStarted: ProjectData = {
  id: 'ns', name: 'NS', pic: 'x', activities: [],
  weeklyBaseline: [wk(0, 10, 0), wk(1, 30, 0)],
  weeklyActual: [wk(0, 0, 0), wk(1, 0, 0)],
};
const emptyActual: ProjectData = {
  id: 'ea', name: 'EA', pic: 'x', activities: [],
  weeklyBaseline: [wk(0, 10, 0)],
  weeklyActual: [],
};

assert.strictEqual(hasActualData(onTrack), true);
assert.strictEqual(hasActualData(notStarted), false);
assert.strictEqual(hasActualData(emptyActual), false);

assert.strictEqual(projectHealth(onTrack), 'on-track');   // variance +5
assert.strictEqual(projectHealth(behind), 'at-risk');     // variance -30
assert.strictEqual(projectHealth(notStarted), 'not-started');
assert.strictEqual(projectHealth(emptyActual), 'not-started');

// boundary: variance exactly -10 is "behind" (not at-risk); < -10 is at-risk
const behindEdge: ProjectData = {
  id: 'be', name: 'BE', pic: 'x', activities: [],
  weeklyBaseline: [wk(0, 30, 0)],
  weeklyActual: [wk(0, 0, 20)], // variance -10
};
assert.strictEqual(projectHealth(behindEdge), 'behind');

// atRiskProjects excludes not-started projects
assert.deepStrictEqual(
  atRiskProjects([onTrack, behind, notStarted, behindEdge]).map((p) => p.id),
  ['b'],
);

console.log('dashboard-metrics OK');
