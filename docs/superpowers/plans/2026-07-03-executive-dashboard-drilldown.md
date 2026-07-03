# Executive Dashboard + Project Drill-Down Implementation Plan (Proyek A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable project portfolio table with a right slide-over drill-down (S-curve + stats + activities) to every role dashboard, backed by a 4-state health model that separates "not started" from "at risk".

**Architecture:** Pure metrics (`utils/dashboardMetrics.ts`) gain a 4-state `projectHealth`. A self-contained `ProjectPortfolio` component (clickable table + drawer state) is dropped into all four role dashboards with role-scoped `projects` from `useData()`. The drawer reuses the project's already-loaded weekly arrays for an instant S-curve and lazy-fetches activities via a new `fetchProjectActivities` + `useProjectDetail` hook.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase JS, recharts (via existing `SCurveChart`), Tailwind v4, existing `components/ui` primitives. Tests are `tsx` assertion scripts (`scripts/test-*.ts`) run with `npx tsx` — the project has no component test runner.

**Verification commands used throughout:**
- Logic tests: `npx tsx scripts/test-dashboard-metrics.ts` → prints `dashboard-metrics OK`
- Build/typecheck of touched app code: `./node_modules/.bin/vite build` (must exit 0)

---

## File Structure

- Modify `utils/dashboardMetrics.ts` — add `ProjectHealth`, `hasActualData`, `projectHealth`; redefine `isAtRisk`/`atRiskProjects` in terms of it.
- Modify `scripts/test-dashboard-metrics.ts` — add health cases.
- Modify `types.ts` — add `ActivityStatus`, `ProjectActivityRow`.
- Modify `lib/supabase.ts` — add `fetchProjectActivities`.
- Create `hooks/useProjectDetail.ts` — lazy-fetch activities for one project.
- Create `components/dashboard/projectHealth.tsx` — shared health/activity → badge maps.
- Create `components/dashboard/ProjectDetailDrawer.tsx` — the slide-over.
- Create `components/dashboard/ProjectPortfolio.tsx` — clickable table + drawer.
- Modify `components/dashboard/StatusDonut.tsx` — 4th "Belum ada realisasi" bucket.
- Modify `pages/dashboards/VpDashboard.tsx`, `PmDashboard.tsx`, `PhDashboard.tsx`, `StaffDashboard.tsx` — wire `ProjectPortfolio` + tiles.
- Delete `components/dashboard/ProjectTable.tsx` — superseded by `ProjectPortfolio`.

---

## Task 1: Health model in dashboardMetrics (TDD)

**Files:**
- Modify: `utils/dashboardMetrics.ts`
- Test: `scripts/test-dashboard-metrics.ts`

- [ ] **Step 1: Write the failing tests**

Append to the end of `scripts/test-dashboard-metrics.ts`, BEFORE the final `console.log('dashboard-metrics OK');` line. Also add `hasActualData, projectHealth` to the import block from `../utils/dashboardMetrics`.

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx scripts/test-dashboard-metrics.ts`
Expected: FAIL — `hasActualData`/`projectHealth` are not exported (import error or `undefined is not a function`).

- [ ] **Step 3: Implement the health model**

In `utils/dashboardMetrics.ts`, replace the existing `isAtRisk` and `atRiskProjects` block:

```typescript
export const AT_RISK_THRESHOLD = -10;
export const isAtRisk = (p: ProjectData): boolean => projectVariance(p) < AT_RISK_THRESHOLD;

export const atRiskProjects = (projects: ProjectData[]): ProjectData[] =>
  projects.filter(isAtRisk);
```

with:

```typescript
export const AT_RISK_THRESHOLD = -10;

export type ProjectHealth = 'not-started' | 'on-track' | 'behind' | 'at-risk';

/** True when the project has at least one non-zero actual reading. */
export const hasActualData = (p: ProjectData): boolean =>
  p.weeklyActual.some((w) => w.actual > 0);

/**
 * 4-state health. Projects with no actual data are 'not-started' (they have not
 * begun, so they are not "behind"). Otherwise bucket by variance.
 */
export const projectHealth = (p: ProjectData): ProjectHealth => {
  if (!hasActualData(p)) return 'not-started';
  const v = projectVariance(p);
  if (v >= 0) return 'on-track';
  if (v < AT_RISK_THRESHOLD) return 'at-risk';
  return 'behind';
};

export const isAtRisk = (p: ProjectData): boolean => projectHealth(p) === 'at-risk';

export const atRiskProjects = (projects: ProjectData[]): ProjectData[] =>
  projects.filter(isAtRisk);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx scripts/test-dashboard-metrics.ts`
Expected: PASS — prints `dashboard-metrics OK`.

- [ ] **Step 5: Commit**

```bash
git add utils/dashboardMetrics.ts scripts/test-dashboard-metrics.ts
git commit -m "feat: add 4-state project health model to dashboard metrics"
```

---

## Task 2: StatusDonut 4th bucket

**Files:**
- Modify: `components/dashboard/StatusDonut.tsx`

- [ ] **Step 1: Rewrite StatusDonut to bucket by projectHealth**

Replace the whole file with:

```tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ProjectData } from '../../types';
import { projectHealth } from '../../utils/dashboardMetrics';
import { COLORS } from '../../constants';
import { Card } from '../ui';

// Buckets projects by 4-state health.
export const StatusDonut: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const count = (h: string) => projects.filter((p) => projectHealth(p) === h).length;
  const data = [
    { name: 'Sesuai/di atas rencana', value: count('on-track'), color: COLORS.statusPositive },
    { name: 'Sedikit tertinggal', value: count('behind'), color: COLORS.statusWarning },
    { name: 'Berisiko', value: count('at-risk'), color: COLORS.statusDanger },
    { name: 'Belum ada realisasi', value: count('not-started'), color: COLORS.statusNeutral },
  ].filter((d) => d.value > 0);

  return (
    <Card title="Distribusi Status">
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada proyek.</p>
      ) : (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/StatusDonut.tsx
git commit -m "feat: add 'belum ada realisasi' bucket to StatusDonut"
```

---

## Task 3: Types + shared badge maps

**Files:**
- Modify: `types.ts`
- Create: `components/dashboard/projectHealth.tsx`

- [ ] **Step 1: Add activity types to `types.ts`**

Append at the end of `types.ts`:

```typescript
export type ActivityStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed';

// Slim, typed activity row for dashboard drill-down (distinct from the legacy
// ActivityData shape used by ProjectData.activities).
export interface ProjectActivityRow {
  id: string;
  code: string | null;
  activityName: string;
  pic: string | null;
  weight: number; // percentage 0-100
  status: ActivityStatus;
}
```

- [ ] **Step 2: Create the shared badge maps**

Create `components/dashboard/projectHealth.tsx`:

```tsx
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
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add types.ts components/dashboard/projectHealth.tsx
git commit -m "feat: add activity types and dashboard badge maps"
```

---

## Task 4: Data layer + useProjectDetail hook

**Files:**
- Modify: `lib/supabase.ts`
- Create: `hooks/useProjectDetail.ts`

- [ ] **Step 1: Add `ProjectActivityRow` to the type import in `lib/supabase.ts`**

In the `import { ... } from '../types';` block near the top, add `ProjectActivityRow,` (next to `PortfolioSeriesPoint`).

- [ ] **Step 2: Add `fetchProjectActivities` to `lib/supabase.ts`**

Insert directly after the existing `fetchActivities` function:

```typescript
/**
 * Slim, typed activity fetch for dashboard drill-down. Returns only the fields
 * the drawer renders (weight + status), unlike the legacy `fetchActivities`.
 */
export async function fetchProjectActivities(projectId: string): Promise<ProjectActivityRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('id, code, activity_name, pic, weight, status')
      .eq('project_id', projectId)
      .order('code', { ascending: true })
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return (data || []).map((a: any) => ({
      id: a.id,
      code: a.code ?? null,
      activityName: a.activity_name,
      pic: a.pic ?? null,
      weight: Number(a.weight) || 0,
      status: (a.status ?? 'not-started') as ProjectActivityRow['status'],
    }));
  } catch (error) {
    console.error('Error fetching project activities:', error);
    return [];
  }
}
```

- [ ] **Step 3: Create `hooks/useProjectDetail.ts`**

```tsx
import { useEffect, useState } from 'react';
import type { ProjectActivityRow } from '../types';
import { fetchProjectActivities } from '../lib/supabase';

interface State {
  activities: ProjectActivityRow[];
  loading: boolean;
  error: string | null;
}

/** Lazily loads one project's activities. Pass null to reset. */
export function useProjectDetail(projectId: string | null): State {
  const [state, setState] = useState<State>({ activities: [], loading: false, error: null });

  useEffect(() => {
    if (!projectId) {
      setState({ activities: [], loading: false, error: null });
      return;
    }
    let alive = true;
    setState({ activities: [], loading: true, error: null });
    fetchProjectActivities(projectId)
      .then((activities) => { if (alive) setState({ activities, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ activities: [], loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, [projectId]);

  return state;
}
```

- [ ] **Step 4: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts hooks/useProjectDetail.ts
git commit -m "feat: add fetchProjectActivities and useProjectDetail hook"
```

---

## Task 5: ProjectDetailDrawer

**Files:**
- Create: `components/dashboard/ProjectDetailDrawer.tsx`

- [ ] **Step 1: Create the drawer**

```tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ProjectData } from '../../types';
import { latestPlanned, latestProgress, projectVariance, projectHealth, portfolioSeries } from '../../utils/dashboardMetrics';
import { useProjectDetail } from '../../hooks/useProjectDetail';
import { SCurveChart } from '../SCurveChart';
import { StatusBadge } from '../ui';
import { HEALTH_BADGE, ACTIVITY_BADGE } from './projectHealth';

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold tracking-tight text-slate-500">{label}</p>
    <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
  </div>
);

export const ProjectDetailDrawer: React.FC<{ project: ProjectData; onClose: () => void }> = ({ project, onClose }) => {
  const { activities, loading, error } = useProjectDetail(project.id);
  const health = HEALTH_BADGE[projectHealth(project)];
  const series = portfolioSeries([project]);
  const variance = projectVariance(project);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <div className="relative h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl custom-scrollbar">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{project.name}</h2>
            <p className="text-sm text-slate-500">PIC: {project.pic}</p>
            <div className="mt-2"><StatusBadge status={health.status} label={health.label} /></div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#0071e3]"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Rencana" value={`${latestPlanned(project)}%`} />
            <Stat label="Aktual" value={`${latestProgress(project)}%`} />
            <Stat label="Varians" value={`${variance > 0 ? '+' : ''}${variance}%`} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-900">Kurva-S</h3>
            {series.length > 0 ? (
              <SCurveChart data={series} showWeekly={false} compact />
            ) : (
              <p className="text-sm text-slate-500">Belum ada data progres.</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-slate-900">Aktivitas</h3>
            {loading ? (
              <p className="text-sm text-slate-500">Memuat aktivitas…</p>
            ) : error ? (
              <p className="text-sm text-red-600">Gagal memuat aktivitas.</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada aktivitas.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-tight text-slate-500">
                      <th className="px-3 py-2">Aktivitas</th>
                      <th className="px-3 py-2">PIC</th>
                      <th className="px-3 py-2 text-right">Bobot</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a) => {
                      const badge = ACTIVITY_BADGE[a.status];
                      return (
                        <tr key={a.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {a.code ? `${a.code}. ` : ''}{a.activityName}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{a.pic || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700">{a.weight}%</td>
                          <td className="px-3 py-2"><StatusBadge status={badge.status} label={badge.label} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ProjectDetailDrawer.tsx
git commit -m "feat: add ProjectDetailDrawer slide-over"
```

---

## Task 6: ProjectPortfolio (clickable table + drawer)

**Files:**
- Create: `components/dashboard/ProjectPortfolio.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { useMemo, useState } from 'react';
import type { ProjectData } from '../../types';
import { latestPlanned, latestProgress, projectVariance, projectHealth } from '../../utils/dashboardMetrics';
import { Card, StatusBadge } from '../ui';
import { HEALTH_BADGE } from './projectHealth';
import { ProjectDetailDrawer } from './ProjectDetailDrawer';

export const ProjectPortfolio: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.pic || '').toLowerCase().includes(q),
    );
  }, [projects, query]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <Card
      title="Portfolio Proyek"
      action={
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari proyek atau PIC…"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        />
      }
    >
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada proyek untuk ditampilkan.</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-tight text-slate-500">
                <th className="px-3 py-2">Proyek</th>
                <th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2 text-right">Rencana</th>
                <th className="px-3 py-2 text-right">Aktual</th>
                <th className="px-3 py-2 text-right">Varians</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const v = projectVariance(p);
                const badge = HEALTH_BADGE[projectHealth(p)];
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(p.id); }}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.pic}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestPlanned(p)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestProgress(p)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{v > 0 ? '+' : ''}{v}%</td>
                    <td className="px-3 py-2"><StatusBadge status={badge.status} label={badge.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ProjectDetailDrawer project={selected} onClose={() => setSelectedId(null)} />}
    </Card>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ProjectPortfolio.tsx
git commit -m "feat: add ProjectPortfolio clickable table with drill-down"
```

---

## Task 7: Wire VpDashboard

**Files:**
- Modify: `pages/dashboards/VpDashboard.tsx`

- [ ] **Step 1: Update imports**

Replace the two import lines for `atRiskProjects` and add the new component + metric:

Change:
```tsx
import { atRiskProjects } from '../../utils/dashboardMetrics';
```
to:
```tsx
import { atRiskProjects, projectHealth } from '../../utils/dashboardMetrics';
import { ProjectPortfolio } from '../../components/dashboard/ProjectPortfolio';
```

- [ ] **Step 2: Replace the "Terlambat" tile and append the portfolio**

Change the tile:
```tsx
        <StatTile label="Terlambat" value="—" icon={<Clock size={20} />} />
```
to:
```tsx
        <StatTile
          label="Belum mulai"
          value={projects.filter((p) => projectHealth(p) === 'not-started').length}
          icon={<Clock size={20} />}
        />
```

Then add the portfolio as the last child, immediately after the `<SCurvePanel ... />` line:
```tsx
      <SCurvePanel title="Kurva-S portfolio" />
      <ProjectPortfolio projects={projects} />
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add pages/dashboards/VpDashboard.tsx
git commit -m "feat: add project portfolio drill-down to VP dashboard"
```

---

## Task 8: Wire PmDashboard (replace ProjectTable)

**Files:**
- Modify: `pages/dashboards/PmDashboard.tsx`

- [ ] **Step 1: Swap ProjectTable import for ProjectPortfolio**

Change:
```tsx
import { ProjectTable } from '../../components/dashboard/ProjectTable';
```
to:
```tsx
import { ProjectPortfolio } from '../../components/dashboard/ProjectPortfolio';
```

- [ ] **Step 2: Replace the ProjectTable usage**

Change:
```tsx
      <ProjectTable projects={projects} />
```
to:
```tsx
      <ProjectPortfolio projects={projects} />
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add pages/dashboards/PmDashboard.tsx
git commit -m "feat: use project portfolio drill-down in PM dashboard"
```

---

## Task 9: Wire PhDashboard

**Files:**
- Modify: `pages/dashboards/PhDashboard.tsx`

- [ ] **Step 1: Add the import**

After the existing `import { AtRiskList } ...` line add:
```tsx
import { ProjectPortfolio } from '../../components/dashboard/ProjectPortfolio';
```

- [ ] **Step 2: Append the portfolio after AtRiskList**

Change:
```tsx
      <AtRiskList projects={projects} />
    </div>
  );
};
```
to:
```tsx
      <AtRiskList projects={projects} />
      <ProjectPortfolio projects={projects} />
    </div>
  );
};
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add pages/dashboards/PhDashboard.tsx
git commit -m "feat: add project portfolio drill-down to PH dashboard"
```

---

## Task 10: Wire StaffDashboard (replace ProjectTable)

**Files:**
- Modify: `pages/dashboards/StaffDashboard.tsx`

- [ ] **Step 1: Swap ProjectTable import for ProjectPortfolio**

Change:
```tsx
import { ProjectTable } from '../../components/dashboard/ProjectTable';
```
to:
```tsx
import { ProjectPortfolio } from '../../components/dashboard/ProjectPortfolio';
```

- [ ] **Step 2: Replace the ProjectTable usage**

Change:
```tsx
      <ProjectTable projects={projects} />
```
to:
```tsx
      <ProjectPortfolio projects={projects} />
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add pages/dashboards/StaffDashboard.tsx
git commit -m "feat: use project portfolio drill-down in Staff dashboard"
```

---

## Task 11: Remove superseded ProjectTable

**Files:**
- Delete: `components/dashboard/ProjectTable.tsx`

- [ ] **Step 1: Confirm there are no remaining importers**

Run: `grep -rn "ProjectTable" pages/ components/ --include="*.tsx"`
Expected: no matches (Pm and Staff now import `ProjectPortfolio`).

- [ ] **Step 2: Delete the file**

```bash
git rm components/dashboard/ProjectTable.tsx
```

- [ ] **Step 3: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: remove ProjectTable superseded by ProjectPortfolio"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the metrics test**

Run: `npx tsx scripts/test-dashboard-metrics.ts`
Expected: `dashboard-metrics OK`.

- [ ] **Step 2: Full build + typecheck of touched code**

Run: `./node_modules/.bin/vite build`
Expected: exit 0. (`tsc --noEmit` still reports the pre-existing errors listed in AGENTS.md — none should be in files touched by this plan: `dashboardMetrics.ts`, `StatusDonut.tsx`, `types.ts`, `supabase.ts`, `useProjectDetail.ts`, `projectHealth.tsx`, `ProjectDetailDrawer.tsx`, `ProjectPortfolio.tsx`, the four dashboards.)

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "ProjectPortfolio|ProjectDetailDrawer|useProjectDetail|projectHealth|StatusDonut|dashboardMetrics|VpDashboard|PmDashboard|PhDashboard|StaffDashboard"`
Expected: no output.

- [ ] **Step 3: Manual smoke test (optional, requires Supabase data)**

Open the app as VP, confirm: "Berisiko" count is realistic (not 31/35), the donut shows a "Belum ada realisasi" slice, the "Portfolio Proyek" table renders, and clicking a row opens the drawer with an S-curve and activity list.
```
