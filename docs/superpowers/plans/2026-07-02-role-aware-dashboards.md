# Role-Aware Dashboards + Design-System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reusable design-system primitives (single Action Blue accent per `DESIGN.md`) and use them to render a different, role-appropriate dashboard for each of the four roles (Staff Officer, Project Head, Project Manager, VP Lingkungan).

**Architecture:** `pages/DashboardNew.tsx` becomes a thin router that reads `role` from `useAuth()` and renders one of four role dashboards. Role dashboards are layout files composing shared widgets (`components/dashboard/`) built from design-system primitives (`components/ui/`). All project data comes from the already-role-scoped `useData().projects`; KPIs/S-curve derive from each `ProjectData`'s `weeklyBaseline`/`weeklyActual` arrays; the per-role action inbox reuses the existing `buildRoleDocumentInbox()` + `getRoleDashboardConfig()` helpers.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind (CDN), `lucide-react`, `recharts` (via existing `SCurveChart`), Supabase. **No unit-test framework exists** — logic is verified with `tsx` scripts (the established pattern, see `scripts/test-cooperation-workflow.ts`); components are verified with `npx tsc --noEmit` + visual checks in the dev server.

---

## Conventions used in every task

- **Type gate:** `npx tsc --noEmit` must pass (no network; safe per-task). Reserve `npm run build` for the final visual task (its `prebuild` hits R2 and needs credentials).
- **Accent rule (`DESIGN.md`):** interactive/selected = Action Blue `#0066cc`; neutrals = slate; emerald/amber/red = *status only, always with an icon*. Never `indigo`.
- **Commit** after each task with the shown message.

---

## File Structure

**Create:**
- `components/ui/Button.tsx` — primary/secondary/tertiary/danger button primitive
- `components/ui/StatusBadge.tsx` — semantic status pill (icon required)
- `components/ui/Card.tsx` — surface container (border + shadow-sm)
- `components/ui/SegmentedTabs.tsx` — segmented tab control
- `components/ui/StatTile.tsx` — KPI tile
- `components/ui/index.ts` — barrel export
- `utils/dashboardMetrics.ts` — pure functions: project progress/variance, at-risk, portfolio aggregate weekly series
- `hooks/useCooperationDocuments.ts` — fetches cooperation documents for the inbox
- `components/dashboard/ActionInbox.tsx` — per-role "needs my action" list
- `components/dashboard/SCurvePanel.tsx` — S-curve card (single project or portfolio aggregate)
- `components/dashboard/AtRiskList.tsx` — projects behind plan
- `components/dashboard/StatusDonut.tsx` — status distribution donut
- `components/dashboard/ProjectTable.tsx` — project list table
- `pages/dashboards/StaffDashboard.tsx`
- `pages/dashboards/PhDashboard.tsx`
- `pages/dashboards/PmDashboard.tsx`
- `pages/dashboards/VpDashboard.tsx`
- `lib/devRoleOverride.ts` — dev-only role override for previewing each dashboard
- `scripts/test-dashboard-metrics.ts` — tsx verification for `dashboardMetrics.ts`

**Modify:**
- `constants.ts` — consolidate `COLORS` to the `DESIGN.md` palette
- `components/SCurveChart.tsx` — actual `#0066cc` solid / plan `#94a3b8` dashed
- `components/WorkSCurveChart.tsx` — same color standardization
- `components/Layout.tsx` — sidebar active state emerald → Action Blue
- `index.html` — `theme-color` → `#0066cc`
- `pages/DashboardNew.tsx` — replace body with the role router
- `context/AuthContext.tsx` — apply dev role override (single line)

---

## Phase 0 — Tokens

### Task 1: Consolidate color tokens in `constants.ts`

**Files:**
- Modify: `constants.ts` (the `COLORS` object)

- [ ] **Step 1: Rewrite the `COLORS` object**

Replace the existing `COLORS` object with:

```ts
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
```

- [ ] **Step 2: Find stale references to removed keys**

Run: `grep -rnE 'COLORS\.(primary|secondary|accent|success|warning|danger|info|planLine|actualLine|targetBar|gradient)' components pages lib utils`
Expected: a list of usages that must be repointed (at minimum `components/SCurveChart.tsx`). If any appear, note them — Tasks 7–8 fix the chart ones; repoint any others to the nearest new key (`primary`→`action`, `success`→`statusPositive`, `danger`→`statusDanger`, `info`→`action`, `actualLine`→`chartActual`, `planLine`→`chartPlan`).

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit`
Expected: PASS (fix any references surfaced in Step 2 until it passes).

- [ ] **Step 4: Commit**

```bash
git add constants.ts
git commit -m "refactor: consolidate COLORS to single Action Blue accent + semantic status"
```

---

## Phase 1 — Design-system primitives

### Task 2: `Button` primitive

**Files:**
- Create: `components/ui/Button.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leadingIcon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#0066cc] text-white hover:bg-[#0055b3] disabled:bg-slate-200 disabled:text-slate-400',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  tertiary: 'bg-transparent text-[#0066cc] hover:underline disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', leadingIcon, className = '', children, ...rest
}) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {leadingIcon}
    {children}
  </button>
);
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.tsx
git commit -m "feat(ui): add Button primitive"
```

### Task 3: `StatusBadge` primitive

**Files:**
- Create: `components/ui/StatusBadge.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';

export type Status = 'positive' | 'warning' | 'danger' | 'neutral';

const STYLES: Record<Status, { cls: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  positive: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  warning:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: AlertTriangle },
  danger:   { cls: 'bg-red-50 text-red-700 border-red-200',             Icon: XCircle },
  neutral:  { cls: 'bg-slate-100 text-slate-600 border-slate-200',      Icon: Circle },
};

export const StatusBadge: React.FC<{ status: Status; label: string }> = ({ status, label }) => {
  const { cls, Icon } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <Icon size={14} />
      {label}
    </span>
  );
};
```

- [ ] **Step 2: Type gate** — Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/StatusBadge.tsx
git commit -m "feat(ui): add StatusBadge primitive (icon-paired status)"
```

### Task 4: `Card` primitive

**Files:**
- Create: `components/ui/Card.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';

interface CardProps {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, action, className = '', children }) => (
  <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        {title && <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </div>
);
```

- [ ] **Step 2: Type gate** — Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Card.tsx
git commit -m "feat(ui): add Card primitive"
```

### Task 5: `SegmentedTabs` primitive

**Files:**
- Create: `components/ui/SegmentedTabs.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';

interface Tab { id: string; label: string; }

interface SegmentedTabsProps {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({ tabs, value, onChange }) => (
  <div className="inline-flex rounded-lg bg-slate-100 p-1">
    {tabs.map((t) => {
      const active = t.id === value;
      return (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] ${
            active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);
```

- [ ] **Step 2: Type gate** — Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/SegmentedTabs.tsx
git commit -m "feat(ui): add SegmentedTabs primitive"
```

### Task 6: `StatTile` primitive + barrel export

**Files:**
- Create: `components/ui/StatTile.tsx`
- Create: `components/ui/index.ts`

- [ ] **Step 1: Write `StatTile.tsx`**

```tsx
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number; // signed percent; omit if not applicable
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, icon, trend }) => {
  const pos = trend !== undefined && trend > 0;
  const zero = trend === 0;
  const trendCls = zero ? 'text-slate-600 bg-slate-100' : pos ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100';
  const TrendIcon = zero ? Minus : pos ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 transition hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-tight text-slate-500">{label}</p>
          <h3 className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</h3>
        </div>
        {icon && <div className="p-2 rounded-lg bg-blue-50 text-[#0066cc]">{icon}</div>}
      </div>
      {trend !== undefined && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendCls}`}>
            <TrendIcon size={14} />{Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Write `index.ts` barrel**

```ts
export { Button } from './Button';
export { StatusBadge } from './StatusBadge';
export type { Status } from './StatusBadge';
export { Card } from './Card';
export { SegmentedTabs } from './SegmentedTabs';
export { StatTile } from './StatTile';
```

- [ ] **Step 3: Type gate** — Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/ui/StatTile.tsx components/ui/index.ts
git commit -m "feat(ui): add StatTile primitive + barrel export"
```

---

## Phase 2 — Chart & chrome standardization

### Task 7: Standardize S-curve chart colors

**Files:**
- Modify: `components/SCurveChart.tsx`
- Modify: `components/WorkSCurveChart.tsx`

- [ ] **Step 1: Locate current series colors**

Run: `grep -nE 'stroke|fill|#[0-9a-fA-F]{3,6}|COLORS\.(planLine|actualLine)|dasharray|strokeDasharray' components/SCurveChart.tsx components/WorkSCurveChart.tsx`
Expected: the `<Line>`/`<Area>` color props for the actual and plan series.

- [ ] **Step 2: Edit each chart so actual = solid Action Blue, plan = dashed slate**

In both files, set the **actual** series `stroke={COLORS.chartActual}` (import `COLORS` from `../constants` if not already), no dash; set the **plan/baseline** series `stroke={COLORS.chartPlan}` with `strokeDasharray="6 4"`. Set `CartesianGrid stroke={COLORS.chartGrid}` and axis tick `fill`/`stroke` to `COLORS.chartAxis`. Keep everything else unchanged.

- [ ] **Step 3: Type gate** — Run: `npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/SCurveChart.tsx components/WorkSCurveChart.tsx
git commit -m "refactor(charts): actual=Action Blue solid, plan=slate dashed"
```

### Task 8: Sidebar active state + theme-color

**Files:**
- Modify: `components/Layout.tsx`
- Modify: `index.html`

- [ ] **Step 1: Swap active-nav accent in `Layout.tsx`**

Run: `grep -nE 'emerald' components/Layout.tsx` to find every active-state class. Replace the active-item classes `bg-emerald-50 text-emerald-700` → `bg-blue-50 text-[#0066cc]`, and the active icon `text-emerald-600` → `text-[#0066cc]`. Leave hover/rest states (slate) unchanged.

- [ ] **Step 2: Swap `theme-color` in `index.html`**

Change `<meta name="theme-color" content="#1e40af" />` → `<meta name="theme-color" content="#0066cc" />`.

- [ ] **Step 3: Verify no emerald remains as accent in Layout**

Run: `grep -nE 'emerald' components/Layout.tsx`
Expected: no matches (emerald was only the active accent here).

- [ ] **Step 4: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add components/Layout.tsx index.html
git commit -m "refactor: sidebar active state + theme-color to Action Blue"
```

---

## Phase 3 — Shared dashboard data & logic

### Task 9: `dashboardMetrics.ts` pure helpers (with tsx test)

**Files:**
- Create: `utils/dashboardMetrics.ts`
- Test: `scripts/test-dashboard-metrics.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/test-dashboard-metrics.ts
import assert from 'node:assert';
import type { ProjectData } from '../types';
import { latestProgress, projectVariance, isAtRisk, portfolioSeries } from '../utils/dashboardMetrics';

const wk = (weekIndex: number, baseline: number, actual: number) => ({
  week: `W${weekIndex}`, weekIndex, year: 2026, baseline, actual,
});

const onTrack: ProjectData = {
  id: 'a', name: 'A', pic: 'x', activities: [],
  weeklyBaseline: [wk(0, 10, 0), wk(1, 30, 0)],
  weeklyActual: [wk(0, 10, 12), wk(1, 30, 35)],
};
const behind: ProjectData = {
  id: 'b', name: 'B', pic: 'y', activities: [],
  weeklyBaseline: [wk(0, 10, 0), wk(1, 50, 0)],
  weeklyActual: [wk(0, 10, 8), wk(1, 50, 20)],
};

// latestProgress reads the last actual cumulative value
assert.strictEqual(latestProgress(onTrack), 35);
// variance = latest actual - latest baseline
assert.strictEqual(projectVariance(behind), 20 - 50);
// at-risk when variance below threshold (-10)
assert.strictEqual(isAtRisk(onTrack), false);
assert.strictEqual(isAtRisk(behind), true);
// portfolio series averages baseline/actual per weekIndex across projects
const series = portfolioSeries([onTrack, behind]);
assert.strictEqual(series.length, 2);
assert.strictEqual(series[1].plan, 50);        // (30+50)/2 = 40? -> see impl note
assert.ok(series[0].month === 'W0');
console.log('dashboard-metrics OK');
```

> Impl note: `portfolioSeries` averages across projects per `weekIndex`. For week 1: plan = (30+50)/2 = 40, actual = (35+20)/2 = 27.5. Adjust the assertion to `series[1].plan === 40` and `series[1].actual === 27.5` after writing the implementation; the point is deterministic averaging.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/test-dashboard-metrics.ts`
Expected: FAIL — `Cannot find module '../utils/dashboardMetrics'`.

- [ ] **Step 3: Write the implementation**

```ts
// utils/dashboardMetrics.ts
import type { ProjectData, WeeklyData, MonthlyData } from '../types';

const lastActual = (series: WeeklyData[]): number =>
  series.length ? series[series.length - 1].actual : 0;
const lastBaseline = (series: WeeklyData[]): number =>
  series.length ? series[series.length - 1].actual : 0; // baseline series stores its curve in `baseline`

export const latestProgress = (p: ProjectData): number => lastActual(p.weeklyActual);

export const latestPlanned = (p: ProjectData): number => {
  const s = p.weeklyBaseline;
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
```

> Note on `latestPlanned`: the planned curve lives in `WeeklyData.baseline` on the `weeklyBaseline` array. Update the Step‑1 assertions to read planned from `baseline` (behind's last baseline = 50, actual = 20 → variance −30). Re-check the numbers so the test asserts variance `=== -30` for `behind` and `false`/`true` for at-risk. Fix the test to match this real shape, then proceed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/test-dashboard-metrics.ts`
Expected: `dashboard-metrics OK` (adjust assertions per the notes until it passes on real data shapes).

- [ ] **Step 5: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add utils/dashboardMetrics.ts scripts/test-dashboard-metrics.ts
git commit -m "feat: dashboard metric helpers (progress, variance, at-risk, portfolio series)"
```

### Task 10: `useCooperationDocuments` hook

**Files:**
- Create: `hooks/useCooperationDocuments.ts`

- [ ] **Step 1: Confirm the fetch function name**

Run: `grep -nE 'export .*fetchCooperationDocuments' lib/supabase.ts`
Expected: `fetchCooperationDocuments` is exported and returns `Promise<CooperationDocument[]>`.

- [ ] **Step 2: Write the hook**

```ts
import { useEffect, useState } from 'react';
import type { CooperationDocument } from '../types';
import { fetchCooperationDocuments } from '../lib/supabase';

interface State {
  documents: CooperationDocument[];
  loading: boolean;
  error: string | null;
}

export function useCooperationDocuments(): State {
  const [state, setState] = useState<State>({ documents: [], loading: true, error: null });

  useEffect(() => {
    let alive = true;
    fetchCooperationDocuments()
      .then((docs) => { if (alive) setState({ documents: docs, loading: false, error: null }); })
      .catch((e) => { if (alive) setState({ documents: [], loading: false, error: String(e?.message ?? e) }); });
    return () => { alive = false; };
  }, []);

  return state;
}
```

- [ ] **Step 3: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add hooks/useCooperationDocuments.ts
git commit -m "feat: useCooperationDocuments hook"
```

---

## Phase 4 — Shared dashboard widgets

### Task 11: `ActionInbox` widget

**Files:**
- Create: `components/dashboard/ActionInbox.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import type { UserRole } from '../../types';
import { useCooperationDocuments } from '../../hooks/useCooperationDocuments';
import { buildRoleDocumentInbox, getRoleDashboardConfig, getCooperationStatusLabel } from '../../lib/cooperationWorkflow';
import { Card, StatusBadge } from '../ui';

export const ActionInbox: React.FC<{ role: UserRole }> = ({ role }) => {
  const { documents, loading, error } = useCooperationDocuments();
  const config = getRoleDashboardConfig(role);
  const items = buildRoleDocumentInbox(documents, role);

  return (
    <Card title={config.inboxTitle}>
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      )}
      {!loading && error && (
        <p className="text-sm text-red-600">Gagal memuat dokumen: {error}</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-500">{config.emptyText}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{doc.title}</p>
                <p className="truncate text-xs text-slate-500">{doc.partnerName}</p>
              </div>
              <StatusBadge status="warning" label={getCooperationStatusLabel(doc.status)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
```

- [ ] **Step 2: Verify the imported helpers exist**

Run: `grep -nE 'export function (buildRoleDocumentInbox|getRoleDashboardConfig|getCooperationStatusLabel)' lib/cooperationWorkflow.ts`
Expected: all three found. (If `getCooperationStatusLabel` differs, use `COOPERATION_STATUS_LABELS[doc.status]`.)

- [ ] **Step 3: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add components/dashboard/ActionInbox.tsx
git commit -m "feat(dashboard): ActionInbox widget (per-role cooperation inbox)"
```

### Task 12: `SCurvePanel` widget

**Files:**
- Create: `components/dashboard/SCurvePanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import type { ProjectData } from '../../types';
import { SCurveChart } from '../SCurveChart';
import { portfolioSeries } from '../../utils/dashboardMetrics';
import { Card } from '../ui';

interface SCurvePanelProps {
  projects: ProjectData[];
  title?: string;
}

// Aggregates all provided projects into one averaged S-curve.
export const SCurvePanel: React.FC<SCurvePanelProps> = ({ projects, title = 'Kurva-S' }) => {
  const data = portfolioSeries(projects);
  return (
    <Card title={title}>
      {data.length > 0 ? (
        <SCurveChart data={data} showWeekly={false} compact />
      ) : (
        <p className="text-sm text-slate-500">Belum ada data progres untuk ditampilkan.</p>
      )}
    </Card>
  );
};
```

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add components/dashboard/SCurvePanel.tsx
git commit -m "feat(dashboard): SCurvePanel widget"
```

### Task 13: `AtRiskList` widget

**Files:**
- Create: `components/dashboard/AtRiskList.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import type { ProjectData } from '../../types';
import { atRiskProjects, projectVariance } from '../../utils/dashboardMetrics';
import { Card, StatusBadge } from '../ui';

export const AtRiskList: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const risky = atRiskProjects(projects);
  return (
    <Card title="Proyek Berisiko">
      {risky.length === 0 ? (
        <p className="text-sm text-slate-500">Semua proyek sesuai atau di atas rencana.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {risky.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                <p className="truncate text-xs text-slate-500">{p.pic}</p>
              </div>
              <StatusBadge status="danger" label={`${projectVariance(p)}%`} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
```

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add components/dashboard/AtRiskList.tsx
git commit -m "feat(dashboard): AtRiskList widget"
```

### Task 14: `StatusDonut` widget

**Files:**
- Create: `components/dashboard/StatusDonut.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ProjectData } from '../../types';
import { isAtRisk, projectVariance } from '../../utils/dashboardMetrics';
import { COLORS } from '../../constants';
import { Card } from '../ui';

// Buckets projects by health using variance.
export const StatusDonut: React.FC<{ projects: ProjectData[] }> = ({ projects }) => {
  const ahead = projects.filter((p) => projectVariance(p) >= 0).length;
  const risk = projects.filter(isAtRisk).length;
  const behind = projects.length - ahead - risk;
  const data = [
    { name: 'Sesuai/di atas rencana', value: ahead, color: COLORS.statusPositive },
    { name: 'Sedikit tertinggal', value: behind, color: COLORS.statusWarning },
    { name: 'Berisiko', value: risk, color: COLORS.statusDanger },
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

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add components/dashboard/StatusDonut.tsx
git commit -m "feat(dashboard): StatusDonut widget"
```

### Task 15: `ProjectTable` widget

**Files:**
- Create: `components/dashboard/ProjectTable.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import type { ProjectData } from '../../types';
import { latestProgress, latestPlanned, projectVariance } from '../../utils/dashboardMetrics';
import { Card, StatusBadge } from '../ui';
import type { Status } from '../ui';

const health = (variance: number): { status: Status; label: string } =>
  variance >= 0 ? { status: 'positive', label: 'On-track' }
  : variance < -10 ? { status: 'danger', label: 'Berisiko' }
  : { status: 'warning', label: 'Tertinggal' };

export const ProjectTable: React.FC<{ projects: ProjectData[] }> = ({ projects }) => (
  <Card title="Daftar Proyek">
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-tight text-slate-500">
            <th className="px-3 py-2">Proyek</th>
            <th className="px-3 py-2">PIC</th>
            <th className="px-3 py-2 text-right">Rencana</th>
            <th className="px-3 py-2 text-right">Aktual</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const v = projectVariance(p);
            const h = health(v);
            return (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                <td className="px-3 py-2 text-slate-600">{p.pic}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestPlanned(p)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{latestProgress(p)}%</td>
                <td className="px-3 py-2"><StatusBadge status={h.status} label={h.label} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Card>
);
```

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add components/dashboard/ProjectTable.tsx
git commit -m "feat(dashboard): ProjectTable widget"
```

---

## Phase 5 — Role dashboards, router, and dev override

### Task 16: Dev-only role override

**Files:**
- Create: `lib/devRoleOverride.ts`
- Modify: `context/AuthContext.tsx`

- [ ] **Step 1: Write the override helper**

```ts
// lib/devRoleOverride.ts
import type { UserRole } from '../types';
import { normalizeUserRole } from './roleUtils';

// DEV ONLY: allows previewing each role dashboard via ?role=vp|pm|ph|staff.
// Guarded by import.meta.env.DEV so it is a no-op in production builds.
export function getDevRoleOverride(): UserRole | null {
  if (!import.meta.env.DEV) return null;
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('role');
  return raw ? normalizeUserRole(raw) : null;
}
```

- [ ] **Step 2: Apply the override in `AuthContext.tsx`**

Find the line `const role = resolveUserRole(user, profile);` and change it to:

```ts
import { getDevRoleOverride } from '../lib/devRoleOverride';
// ...
const role = getDevRoleOverride() ?? resolveUserRole(user, profile);
```

(Add the import near the other `lib/roleUtils` import.)

- [ ] **Step 3: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add lib/devRoleOverride.ts context/AuthContext.tsx
git commit -m "feat: dev-only ?role= override for previewing role dashboards"
```

### Task 17: `StaffDashboard`

**Files:**
- Create: `pages/dashboards/StaffDashboard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { FolderKanban, FileEdit, CalendarClock, Upload } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { SCurvePanel } from '../../components/dashboard/SCurvePanel';
import { ProjectTable } from '../../components/dashboard/ProjectTable';

export const StaffDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Staff Officer</h1>
        <p className="text-sm text-slate-500">Draft, upload versi, dan kelengkapan metadata.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Proyek saya" value={projects.length} icon={<FolderKanban size={20} />} />
        <StatTile label="Perlu draft/upload" value="—" icon={<FileEdit size={20} />} />
        <StatTile label="Evidence perlu update" value="—" icon={<Upload size={20} />} />
        <StatTile label="Deadline terdekat" value="—" icon={<CalendarClock size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="staff_officer" />
        <SCurvePanel projects={projects} title="Progres proyek saya" />
      </div>
      <ProjectTable projects={projects} />
    </div>
  );
};
```

> The `"—"` KPIs are placeholders for data not yet sourced (per spec §10.5 — never fabricate precise numbers). Leave them as em-dash literals; a follow-up plan wires real counts.

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add pages/dashboards/StaffDashboard.tsx
git commit -m "feat(dashboard): StaffDashboard"
```

### Task 18: `PhDashboard`

**Files:**
- Create: `pages/dashboards/PhDashboard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { FolderKanban, ClipboardCheck, AlertTriangle, ListTodo } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { SCurvePanel } from '../../components/dashboard/SCurvePanel';
import { AtRiskList } from '../../components/dashboard/AtRiskList';
import { atRiskProjects } from '../../utils/dashboardMetrics';

export const PhDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Project Head</h1>
        <p className="text-sm text-slate-500">Review substansi program dan evidence.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Proyek ditugaskan" value={projects.length} icon={<FolderKanban size={20} />} />
        <StatTile label="Perlu review" value="—" icon={<ClipboardCheck size={20} />} />
        <StatTile label="Berisiko" value={atRiskProjects(projects).length} icon={<AlertTriangle size={20} />} />
        <StatTile label="Tindak lanjut" value="—" icon={<ListTodo size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="project_head" />
        <SCurvePanel projects={projects} title="Progres proyek ditugaskan" />
      </div>
      <AtRiskList projects={projects} />
    </div>
  );
};
```

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add pages/dashboards/PhDashboard.tsx
git commit -m "feat(dashboard): PhDashboard"
```

### Task 19: `PmDashboard`

**Files:**
- Create: `pages/dashboards/PmDashboard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { FolderKanban, ShieldCheck, GitPullRequestArrow, FileCheck } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { AtRiskList } from '../../components/dashboard/AtRiskList';
import { ProjectTable } from '../../components/dashboard/ProjectTable';
import { atRiskProjects } from '../../utils/dashboardMetrics';

export const PmDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard Project Manager</h1>
        <p className="text-sm text-slate-500">Validasi portfolio dan bottleneck dokumen.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total proyek" value={projects.length} icon={<FolderKanban size={20} />} />
        <StatTile label="Perlu validasi" value="—" icon={<ShieldCheck size={20} />} />
        <StatTile label="Bottleneck" value={atRiskProjects(projects).length} icon={<GitPullRequestArrow size={20} />} />
        <StatTile label="Kelengkapan dok." value="—" icon={<FileCheck size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="project_manager" />
        <AtRiskList projects={projects} />
      </div>
      <ProjectTable projects={projects} />
    </div>
  );
};
```

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add pages/dashboards/PmDashboard.tsx
git commit -m "feat(dashboard): PmDashboard"
```

### Task 20: `VpDashboard`

**Files:**
- Create: `pages/dashboards/VpDashboard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { Briefcase, Stamp, AlertTriangle, Clock } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatTile } from '../../components/ui';
import { ActionInbox } from '../../components/dashboard/ActionInbox';
import { SCurvePanel } from '../../components/dashboard/SCurvePanel';
import { StatusDonut } from '../../components/dashboard/StatusDonut';
import { atRiskProjects } from '../../utils/dashboardMetrics';

export const VpDashboard: React.FC = () => {
  const { projects } = useData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard VP Lingkungan</h1>
        <p className="text-sm text-slate-500">Executive approval dan pemantauan risiko lintas portfolio.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total proyek" value={projects.length} icon={<Briefcase size={20} />} />
        <StatTile label="Menunggu approval" value="—" icon={<Stamp size={20} />} />
        <StatTile label="Portfolio berisiko" value={atRiskProjects(projects).length} icon={<AlertTriangle size={20} />} />
        <StatTile label="Terlambat" value="—" icon={<Clock size={20} />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionInbox role="vp_lingkungan" />
        <StatusDonut projects={projects} />
      </div>
      <SCurvePanel projects={projects} title="Kurva-S portfolio" />
    </div>
  );
};
```

- [ ] **Step 2: Type gate + commit**

Run: `npx tsc --noEmit` — Expected: PASS.
```bash
git add pages/dashboards/VpDashboard.tsx
git commit -m "feat(dashboard): VpDashboard"
```

### Task 21: Wire the router in `DashboardNew.tsx`

**Files:**
- Modify: `pages/DashboardNew.tsx`

- [ ] **Step 1: Confirm the current export signature**

Run: `grep -nE 'export const DashboardNew|DashboardNewProps|onOpenManageDataForSCurve' pages/DashboardNew.tsx`
Expected: `DashboardNew` takes an optional `onOpenManageDataForSCurve` prop (passed in `App.tsx`).

- [ ] **Step 2: Replace the file body with the role router**

Replace the entire contents of `pages/DashboardNew.tsx` with:

```tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { StaffDashboard } from './dashboards/StaffDashboard';
import { PhDashboard } from './dashboards/PhDashboard';
import { PmDashboard } from './dashboards/PmDashboard';
import { VpDashboard } from './dashboards/VpDashboard';

// Keeps the prop that App.tsx passes; role dashboards don't need it yet
// but the signature stays stable to avoid touching App.tsx.
interface DashboardNewProps {
  onOpenManageDataForSCurve?: () => void;
}

export const DashboardNew: React.FC<DashboardNewProps> = () => {
  const { role } = useAuth();
  switch (role) {
    case 'vp_lingkungan': return <VpDashboard />;
    case 'project_manager': return <PmDashboard />;
    case 'project_head': return <PhDashboard />;
    case 'staff_officer':
    default: return <StaffDashboard />;
  }
};
```

> If Step 1 shows the prop is required (not optional) in `App.tsx`, keep it optional here — passing an unused optional prop is safe and avoids editing `App.tsx`.

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add pages/DashboardNew.tsx
git commit -m "feat(dashboard): route DashboardNew to per-role dashboards"
```

---

## Phase 6 — Final verification

### Task 22: Build + grep gate + visual check of all four roles

**Files:** none (verification only)

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 2: Accent grep gate**

Run:
```bash
grep -rnE '(bg|text|border|ring)-indigo' components/ui components/dashboard pages/dashboards pages/DashboardNew.tsx components/Layout.tsx
grep -rnE '(bg|text|border|ring)-(emerald|purple|violet|sky)-[0-9]' components/dashboard pages/dashboards pages/DashboardNew.tsx components/Layout.tsx
```
Expected: **first command — no matches**. Second command — matches allowed ONLY inside `StatusBadge` usage / status buckets (emerald as *positive status*); no emerald/purple/sky used as an interactive accent. Review each hit; fix any that are decorative.

- [ ] **Step 3: Run the dev server**

Run: `npm run dev`
Expected: Vite serves on localhost (note the port). No console errors on load.

- [ ] **Step 4: Visually verify each role dashboard**

Visit each URL (dev override), confirm the mapped widgets render with a single blue accent and no layout breakage:
- `http://localhost:<port>/?role=staff` → StaffDashboard (inbox + my-projects S-curve + project table)
- `http://localhost:<port>/?role=ph` → PhDashboard (review inbox + S-curve + at-risk)
- `http://localhost:<port>/?role=pm` → PmDashboard (validation inbox + at-risk + table)
- `http://localhost:<port>/?role=vp` → VpDashboard (approval inbox + donut + portfolio S-curve)

Take a screenshot of each for the record.

- [ ] **Step 5: Production build sanity (optional, needs R2 creds)**

Run: `npm run build`
Expected: build succeeds. If the `prebuild` R2/CORS step fails for lack of credentials, that is unrelated to this work — `npx tsc --noEmit` passing in Step 1 is the authoritative type gate.

- [ ] **Step 6: Final commit (if any fixes were made in Steps 2–4)**

```bash
git add -A
git commit -m "chore: role-dashboard verification fixes"
```

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- §5.1 tokens → Task 1. §5.2 primitives → Tasks 2–6. §5.3 charts → Task 7. §5.4 chrome → Task 8.
- §4 architecture (router + dirs) → Tasks 16, 21 + file structure. §3 reuse (scoping, `buildRoleDocumentInbox`, `getRoleDashboardConfig`) → Tasks 11, 17–20.
- §6 per-role content → Tasks 17–20. §7 widget contracts → Tasks 11–15. §10.2 hook → Task 10. §10.3 role override → Task 16. §9 verification → Task 22.
- §10.5 no-fabrication → StaffDashboard/etc. use `"—"` for unsourced KPIs, documented inline.

**Placeholder scan:** The only literal placeholders are the intentional `"—"` KPI values (spec §10.5 forbids fabricating precise numbers); each is documented as awaiting a data source in a follow-up. No "TBD"/"implement later" steps; every code step shows complete code.

**Type consistency:** `dashboardMetrics.ts` exports (`latestProgress`, `latestPlanned`, `projectVariance`, `isAtRisk`, `atRiskProjects`, `portfolioSeries`, `AT_RISK_THRESHOLD`) are used with those exact names in Tasks 12–20. `ui/index.ts` barrel exports (`Button`, `StatusBadge`, `Status`, `Card`, `SegmentedTabs`, `StatTile`) match all consumer imports. `ActionInbox` prop `role: UserRole` matches the role-string literals passed by each dashboard. `SCurveChart` is fed `data: MonthlyData[]` (its real prop).

**Known runtime caveat to confirm during execution:** the metric helpers read the *cumulative* value from the last element of `weeklyActual`/`weeklyBaseline` (`.actual` / `.baseline` respectively). If a project's weekly arrays are unsorted, sort by `weekIndex` before taking the last element — Task 9 Step 3's `portfolioSeries` already keys by `weekIndex`; add a sort in `latestProgress`/`latestPlanned` if execution reveals unsorted data.
```
