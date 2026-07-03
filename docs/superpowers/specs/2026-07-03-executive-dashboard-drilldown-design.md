# Executive Dashboard + Project Drill-Down — Design (Proyek A)

Date: 2026-07-03
Status: Approved (design), pending implementation plan

## Goal

Turn the role dashboards into an executive summary where each role sees a view
tailored to its job, and any project can be inspected in place: click a project
→ a right slide-over drawer shows its S-curve, summary stats, and activity
breakdown — without leaving the dashboard or opening Manage Data.

Primary user value (confirmed): **drill-down per project**. Secondary: a
trustworthy health signal so the executive summary is not misleading.

## Scope

In scope:
- A reusable, clickable project portfolio table with a right slide-over
  project-detail drawer, added to all four role dashboards (scoped per role).
- A 4-state project health model that separates "not started" from "at risk".
- `StatusDonut` gains a 4th "Belum ada realisasi" bucket.
- Per-role differentiation of KPI tiles / emphasis.

Out of scope (explicitly deferred):
- Project info block (location, budget, description) and evidence/document files
  in the drawer. The drawer shows only S-curve + stats + activities for now.
- Any write/edit from the dashboard (read-only drill-down).
- The Coordination Hub (Proyek B, separate spec).

## Data sources (no schema changes)

Everything needed already exists after the DataContext fix:
- `useData().projects` (`ProjectData[]`) — scoped per role, with
  `weeklyBaseline`/`weeklyActual` populated from `s_curve_baseline`/
  `s_curve_actual`. Used for the table rows, stats, and the drawer's S-curve.
- `lib/supabase.ts` `fetchActivities(projectId)` → `ActivityData[]`
  (`activityName`, `pic`, `weight`, `status`, dates) — lazy-fetched by the drawer.
- `components/SCurveChart.tsx`, `utils/dashboardMetrics.ts`, and the
  `components/ui` primitives (`Card`, `StatusBadge`, `StatTile`, `SegmentedTabs`).

## Health model — `utils/dashboardMetrics.ts`

Add:
- `hasActualData(p: ProjectData): boolean` — `p.weeklyActual.some(w => w.actual > 0)`.
- `type ProjectHealth = 'not-started' | 'on-track' | 'behind' | 'at-risk'`.
- `projectHealth(p): ProjectHealth`:
  - no actual data → `'not-started'`
  - else `v = projectVariance(p)`: `v >= 0` → `'on-track'`;
    `v < AT_RISK_THRESHOLD` (−10) → `'at-risk'`; otherwise → `'behind'`.
- Update `atRiskProjects` to return only `projectHealth(p) === 'at-risk'`
  (excludes not-started), so the "Portfolio berisiko" KPI stops counting
  projects that simply have not started.

Existing `latestProgress`, `latestPlanned`, `projectVariance`, `AT_RISK_THRESHOLD`
are reused unchanged.

Map health → badge tone (DESIGN.md): on-track = positive (emerald), behind =
warning (amber), at-risk = danger (red), not-started = neutral (slate). Always
paired with an icon via `StatusBadge`.

## Components

### `components/dashboard/StatusDonut.tsx` (update)
Add a 4th slice "Belum ada realisasi" (neutral/slate) for `projectHealth === 'not-started'`.
Buckets computed from `projectHealth`, not raw variance. Empty slices filtered out.

### `components/dashboard/ProjectPortfolio.tsx` (new, self-contained)
- Props: `{ projects: ProjectData[] }`.
- Renders a `Card` titled "Portfolio Proyek" containing:
  - A simple search box (filter by name/PIC, client-side).
  - A clickable table: Proyek · PIC · Rencana% (`latestPlanned`) · Aktual%
    (`latestProgress`) · Varians (`projectVariance`) · Status (`StatusBadge` from
    `projectHealth`). Rows are buttons (keyboard-focusable, `hover:bg-slate-50`).
  - Empty state when `projects.length === 0`.
- Owns `selectedProjectId` state; renders `<ProjectDetailDrawer>` when set.
- This is the single integration point each dashboard drops in — no per-dashboard
  drawer wiring.

### `components/dashboard/ProjectDetailDrawer.tsx` (new)
- Props: `{ project: ProjectData; onClose: () => void }`.
- Right slide-over panel (fixed, `w-full max-w-xl`, translucent backdrop, close
  on backdrop click / Esc). Follows DESIGN.md radii/shadows.
- Header: project name, PIC, `StatusBadge` (health), and three stat figures
  (Rencana%, Aktual%, Varians) using `tabular-nums`.
- S-curve: `SCurveChart data={portfolioSeries([project])} compact />` — instant,
  no fetch (single-project series reuses the existing aggregator).
- Activities: `useProjectDetail(project.id)` lazy-fetches `fetchActivities`;
  shows loading, error, and empty states, then a table: Aktivitas · PIC ·
  Bobot% · Progress% · Status.

### `hooks/useProjectDetail.ts` (new)
- `useProjectDetail(projectId): { activities, loading, error }`.
- Calls `fetchActivities(projectId)` on open with an `AbortSignal.timeout(5000)`.
- Optional lightweight per-id module cache (30s) to avoid refetch when reopening
  the same project; matches the `useCooperationDocuments` pattern. Cache is
  optional for v1 — a plain fetch-on-open is acceptable.

## Per-role wiring

Each role dashboard adds `<ProjectPortfolio projects={projects} />` (projects
already scoped via `useData`) and adjusts KPI tiles:

| Role  | KPI tiles                                            | Portfolio scope    |
|-------|-----------------------------------------------------|--------------------|
| VP    | Total · Menunggu approval · Berisiko · Belum mulai  | all projects       |
| PM    | Total · Perlu validasi · Berisiko · On-track        | all projects       |
| PH    | Ditugaskan · Perlu review · Berisiko · Belum mulai  | assigned projects  |
| Staff | Proyek saya · Perlu draft/upload · Progress rata² · Belum mulai | my projects |

"Berisiko" uses the corrected `atRiskProjects`. "Belum mulai" =
`projects.filter(p => projectHealth(p) === 'not-started').length`. Existing
inbox components (`ActionInbox`) and `SCurvePanel` stay as-is. `DashboardNew.tsx`
keeps providing the outer padding wrapper (no padding inside components).

## Testing

Extend `scripts/test-dashboard-metrics.ts`:
- `projectHealth` returns `'not-started'` when no actual > 0.
- `'on-track'` / `'behind'` / `'at-risk'` boundaries around variance 0 and −10.
- `atRiskProjects` excludes not-started projects.

Verify with `./node_modules/.bin/vite build` and `npx tsx scripts/test-dashboard-metrics.ts`.

## Risks / notes

- Health depends on `weeklyActual` being populated (done via DataContext). If a
  project has monthly S-curve rows with all-zero actual, it correctly reads as
  not-started.
- Drawer S-curve reuses `portfolioSeries([project])`; a single project yields its
  own (unaveraged) curve — correct behaviour.
- DataContext loads once per session; the drawer's activities are always fresh
  (lazy fetch), but table stats reflect the session's initial load.
```
