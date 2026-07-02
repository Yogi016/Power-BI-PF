# Design Spec — Role-Aware Dashboards + Design-System Foundation

**Date:** 2026-07-02
**Status:** Approved (brainstorming) → ready for implementation plan
**Related:** [`DESIGN.md`](../../../DESIGN.md), [cooperation role enforcement & project scoping](2026-07-02-cooperation-role-enforcement-and-project-scoping-design.md)

## 1. Goal

Deliver two things in one pass:

1. **Design-system foundation** — reusable primitive components that own the [`DESIGN.md`](../../../DESIGN.md) tokens (single Action Blue accent, slate neutrals, semantic status colors, one shadow), plus chart-color standardization. This ends the current 3-way accent drift (emerald / indigo / blue).
2. **Role-aware dashboards** — the live dashboard (`DashboardNew.tsx`) renders a **different view per role** so each user sees what matters to their job. Better UX; no more one-size-fits-all dashboard.

The two are combined because the dashboard is the pilot surface that proves the foundation.

## 2. Non-Goals (out of scope for this plan)

- Migrating the other 13 pages / remaining components to the primitives (follow-up plan; they reuse what we build here).
- Changing project **visibility/scoping** logic — already implemented (`utils/projectScope.ts` → `DataContext.visibleProjects`). We consume it, we don't touch it.
- Moving off CDN Tailwind to a build-time config.
- Nav gating / in-app user management (explicitly deferred in the scoping spec).
- Real-time inbox counts / websockets — inboxes read from a normal fetch.

## 3. Existing building blocks to REUSE (do not reinvent)

Discovery confirmed these already exist and must be built on:

| Asset | Location | Use |
|---|---|---|
| Project scoping | `utils/projectScope.ts` → `DataContext` exposes `visibleProjects` | `useData()` projects are already role-scoped (staff/PH = assigned; PM/VP = all). Dashboards just consume `projects`. |
| `getRoleDashboardConfig(role)` | `lib/cooperationWorkflow.ts` | Returns `{ ...RoleProfile, focusTitle, inboxTitle, emptyText }` per role — drives `ActionInbox` headings. |
| `buildRoleDocumentInbox(docs, role)` | `lib/cooperationWorkflow.ts` | Returns the cooperation documents awaiting *this role's* action. The `ActionInbox` data logic. |
| `fetchCooperationDocuments()` | `lib/supabase.ts` | Source of cooperation documents. |
| `COLORS` | `constants.ts` | Existing (partly-wrong) color token object — to be corrected, not replaced. |
| `useAuth()` → `role`, `profile` | `context/AuthContext.tsx` | Role + assigned project ids. |

## 4. Architecture

### 4.1 Dashboard router
`pages/DashboardNew.tsx` becomes a **thin router** (keeps the routed name/API stable in `App.tsx`):

```
DashboardNew()
  const { role } = useAuth()
  switch (role):
    staff_officer  → <StaffDashboard/>
    project_head   → <PhDashboard/>
    project_manager→ <PmDashboard/>
    vp_lingkungan  → <VpDashboard/>
```

### 4.2 Directory layout
```
components/ui/            ← design-system primitives (Button, StatusBadge, Card, SegmentedTabs, StatTile)
components/dashboard/     ← shared dashboard widgets (SCurvePanel, AtRiskList, ActionInbox, StatusDonut, ProjectTable)
pages/dashboards/         ← StaffDashboard, PhDashboard, PmDashboard, VpDashboard (layout composition only)
hooks/useCooperationDocuments.ts  ← small reusable fetch hook for ActionInbox
```

Each role dashboard is a **layout file** that arranges shared widgets — no data logic duplicated. This keeps every role view small, readable, and independently adjustable.

### 4.3 Data flow
- Projects: `useData().projects` (already role-scoped) → KPIs, SCurve, AtRiskList, ProjectTable.
- Cooperation inbox: `useCooperationDocuments()` → `buildRoleDocumentInbox(docs, role)` → `ActionInbox`.
- No new scoping logic; PM/VP naturally get all projects, staff/PH get assigned.

## 5. Design-system foundation

### 5.1 Token consolidation (`constants.ts`)
Rewrite `COLORS` to match `DESIGN.md` and delete the stale entries:
- **Add:** `action #0066cc`, `actionHover #0055b3`, `actionFocus #0071e3`, `actionOnDark #2997ff`, `actionTint #eff6ff`.
- **Status:** `positive #059669`, `warning #d97706`, `danger #dc2626`, `neutral #475569`.
- **Charts:** `chartActual #0066cc`, `chartPlan #94a3b8` (was `actualLine` sky / `planLine` orange — remove).
- **Keep:** slate ramp.
- **Remove:** `primary #1e40af`, `secondary` emerald-as-brand, `targetBar` purple, decorative `gradient*` (unless a consumer still needs them — verify before deleting).

### 5.2 Primitives (`components/ui/`) — per `DESIGN.md` §7
Each: focus-visible ring `#0071e3`, `active:scale-[0.98]`, WCAG-AA contrast.
- **`Button`** — `variant: primary | secondary | tertiary | danger`, optional leading icon, `disabled`.
- **`StatusBadge`** — `status: positive | warning | danger | neutral`; **icon required** (survives PDF export + color-blindness).
- **`Card`** — `bg-white border-slate-200 rounded-xl shadow-sm`; optional `title`.
- **`SegmentedTabs`** — active tab = Action Blue; the dashboard's existing tab pattern.
- **`StatTile`** — label / `tabular-nums` value / optional trend pill (positive=emerald, negative=red, neutral=slate).

### 5.3 Chart standardization
`SCurveChart.tsx` + `WorkSCurveChart.tsx`: **actual = `#0066cc` solid, plan = `#94a3b8` dashed**, grid `slate-200`, axis labels `slate-500`, pulling from corrected `COLORS`.

### 5.4 Shared chrome (so the dashboard reads as converged)
- `Layout.tsx` sidebar active state: `bg-emerald-50 text-emerald-700` → `bg-blue-50 text-[#0066cc]`.
- `index.html` `theme-color`: `#1e40af` → `#0066cc`.

## 6. Per-role dashboard content

Each view: **≈4 KPI `StatTile`s + 2–3 widgets**, composed from the shared library. Emerald appears only as *positive status*, never as accent.

| Role | Scope | KPIs (StatTile) | Widgets |
|---|---|---|---|
| **Staff Officer** | assigned | My projects · docs to draft/upload · evidence to update · upcoming deadlines | `ActionInbox` ("Draft dan Revisi") · `SCurvePanel` (my projects) · recent activity list |
| **Project Head** | assigned | Assigned projects · items to review · at-risk (mine) · open follow-ups | `ActionInbox` ("Review Project Head") · `SCurvePanel` per assigned project · evidence status |
| **Project Manager** | all | Total projects · items to validate · bottlenecks · doc completeness % | `ActionInbox` ("Validasi Project Manager") · `AtRiskList` (cross-project) · `ProjectTable` w/ completeness |
| **VP Lingkungan** | all | Portfolio progress · approvals pending · portfolio at-risk · overdue | `ActionInbox` ("Menunggu Approval VP") · `SCurvePanel` (portfolio aggregate) · `StatusDonut` |

Inbox titles/empty-text come from `getRoleDashboardConfig(role)`; inbox items from `buildRoleDocumentInbox()`.

## 7. Shared widget contracts (`components/dashboard/`)

| Widget | Props | Data source | Notes |
|---|---|---|---|
| `ActionInbox` | `role` | `useCooperationDocuments()` + `buildRoleDocumentInbox` | Title/empty via `getRoleDashboardConfig`. Rows use `StatusBadge`. Loading = skeleton rows; empty = composed empty state. |
| `SCurvePanel` | `projects`, `mode: 'single' | 'aggregate'` | `useData()` | Wraps existing `SCurveChart` with standardized colors. |
| `AtRiskList` | `projects` | `useData()` | Projects where progress < plan; each row `StatusBadge` + gap. |
| `StatusDonut` | `projects` | `useData()` | Distribution by status; series from `COLORS`. |
| `ProjectTable` | `projects`, `columns` | `useData()` | Uses `DESIGN.md` table rules (hairline rows, `tabular-nums`, no zebra). |
| `StatTile` | `label`, `value`, `trend?`, `icon?` | caller | Primitive (§5.2), reused here. |

Every widget implements loading / empty / error states (`DESIGN.md` mandates full state cycles).

## 8. Design-system application

All new/edited UI follows `DESIGN.md`: single Action Blue accent, slate neutrals, `tracking-tight` headings, `tabular-nums` figures, radius grammar (`rounded-xl` cards / `rounded-lg` controls / `rounded-full` pills/badges), `shadow-sm` on cards only, `active:scale-[0.98]`, one primary button per view, status color = meaning + icon only. `MOTION 3` — subtle transitions, `prefers-reduced-motion` respected.

## 9. Verification

- `npm run build` (tsc) passes.
- **Grep gate:** no `indigo` on migrated surface; no `emerald`/`purple` used as *accent* (only status) in `DashboardNew`, `pages/dashboards/*`, `components/dashboard/*`, `components/ui/*`, `Layout.tsx`.
- **Visual:** run dev server; using a temporary role override (see §10.3), screenshot all four role dashboards; confirm each renders its mapped widgets with a single accent.

## 10. Decisions & assumptions

1. **Fail-open scoping preserved.** A scoped role with empty `assignedProjectIds` (or CSV fallback) sees all projects — matches the scoping spec; dashboards inherit this, no special handling.
2. **`ActionInbox` fetches independently** via a new `useCooperationDocuments()` hook (fetch on mount). Not wired into a global store; acceptable for one consumer now, reusable later.
3. **Role override for testing:** a dev-only mechanism (e.g. `?role=` query param or a temporary toggle) to preview each role dashboard without four accounts. Removed/guarded before ship — not a user-facing feature.
4. **`useNewDashboard` flag** stays `true`; the legacy `Dashboard.tsx` is untouched and out of scope.
5. **Recent-activity / evidence-status / completeness-%** widgets: if a clean data source doesn't exist, the plan may render them from available `projects`/activity data or mark them as a clearly-labeled follow-up rather than fabricate precise numbers (`DESIGN.md` bans fake-precise data).

## 11. Follow-up (after this plan)

- Migrate remaining 13 pages + components to the primitives (mechanical, reuses `components/ui/`).
- Promote cooperation documents to a shared context if a second consumer appears.
- Optional: build-time Tailwind config with named token classes.
