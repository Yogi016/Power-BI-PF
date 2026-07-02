# Power-BI-PF Agent Notes

This repo is a Vite + React SPA for the Pertamina Foundation "Project Fungsi Lingkungan" dashboard. Keep user-facing product copy in Bahasa Indonesia unless the user explicitly asks otherwise.

## Operating Defaults

- Read the current code path before answering repo fact questions. This app has several overlapping legacy/new pages and helper layers.
- Use `rg` for file and text search.
- Use `apply_patch` for manual edits.
- Keep changes scoped. Do not refactor unrelated dashboard, Supabase, R2, or chatbot code while fixing a specific workflow.
- Do not commit secrets or print `.env.local` values. It contains live service configuration.
- This repo uses SPA state routing, not URL route files. Page additions need `PageView`, `App.tsx`, and `components/Layout.tsx` wiring.

## Safe Verification

- Prefer `./node_modules/.bin/vite build` for verification.
- Avoid `npm run build` unless the user explicitly wants the prebuild side effect, because it runs `tsx scripts/update_r2_cors.ts` and can update or generate Cloudflare R2 CORS configuration.
- For PKS/MOU workflow logic, run `npx tsx scripts/test-cooperation-workflow.ts`.
- For Danta.AI asset coverage, use `scripts/test-chatbot-assets.ts` when relevant.
- For report-agent behavior, use `scripts/test-report-agent.ts` if present in the checkout.
- `vite build` may emit chunk-size, dynamic-import, Rollup annotation, or Browserslist warnings. Treat those as warnings unless the process exits non-zero.

## App Shell

- Entry point: `App.tsx`
- Auth wrapper: `context/AuthContext.tsx`
- Shared data wrapper: `context/DataContext.tsx`
- Layout and navigation: `components/Layout.tsx`
- Global chatbot mount: `components/AIChatbot.tsx`
- Page enum: `types.ts` -> `PageView`

`App.tsx` chooses page components through `activePage`. The global `<AIChatbot />` is mounted after the layout, so missing AI knowledge usually means missing snapshot/query coverage rather than missing chatbot visibility.

## Main Pages

- `Dashboard`: active default is `pages/DashboardNew.tsx`; legacy page remains `pages/Dashboard.tsx`.
- `Manage Data`: active default is `pages/ManageDataNew.tsx`; legacy page remains `pages/ManageData.tsx`.
- `Work`: `pages/WorkPage.tsx`, work project and daily data workflow.
- `Gantt Chart`: `pages/GanttPage.tsx`.
- `Calendar`: `pages/CalendarPage.tsx`.
- `Ling-Sign`: `pages/LingSignPage.tsx`, signature and signed-document workflow.
- `Dokumen`: `pages/DokumenPage.tsx`, archive/category document records only.
- `PKS/MOU`: `pages/CooperationDocumentsPage.tsx`, cooperation-document workflow.
- `Asset`: `pages/AssetPage.tsx`, team file cabinet backed by R2 and Supabase metadata.
- `Close Project`: `pages/CloseProjectPage.tsx`.
- `Login`: `pages/LoginPage.tsx`.

When adding a page, update `types.ts`, `App.tsx`, desktop nav, and mobile nav in `components/Layout.tsx`.

## Data Loading Model

`context/DataContext.tsx` loads data in this order:

1. CSV fallback from `public/data/scurve-user.csv`, then `public/data/scurve-final.csv`.
2. Supabase data if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
3. Initial constants from `constants.ts` when external data is unavailable.

The Supabase load runs three queries in parallel via `Promise.all` (projects with nested activities, weekly summary, and tasks). Do not revert these to serial `await` chains — sequential fetches add 4-8 seconds of unnecessary latency.

CSV parsing lives in `utils/csvParser.ts`. Supabase helpers live mostly in `lib/supabase.ts`.

## Supabase

- Client: `lib/supabaseClient.ts`
- Main helper module: `lib/supabase.ts`
- Migrations: `supabase/migrations/`
- Schema snapshot: `supabase/schema.sql`

Important table/workflow areas:

- Projects and activities: `projects`, `activities`, activity weekly progress, project metrics.
- Work page: work projects, daily data, and plan schedule helpers in `lib/supabase.ts`.
- Ling-Sign: signature and signed-document helpers in `lib/supabase.ts`.
- Dokumen archive: document categories and document records.
- Asset page: `assets` table from `supabase/migrations/20260608045633_create_assets_table.sql`.
- PKS/MOU: cooperation document tables from `supabase/migrations/20260702010000_create_cooperation_documents.sql`.
- Roles and profiles: `app_roles` and `user_profiles` from `supabase/migrations/20260702020000_create_user_profiles_roles.sql`.

Apply migrations only to the correct Supabase project. A prior check found the local `.env.local` Supabase ref differed from the Supabase MCP-accessible project, so do not run migrations through MCP unless the target project ref is confirmed first.

## Authentication And Roles

Operational roles are:

- `vp_lingkungan`: VP Lingkungan, 1 person, executive approval and cross-portfolio risk view.
- `project_manager`: Project Manager, 2 people, portfolio validation and bottleneck review.
- `project_head`: Project Head, 4 people, project substance review and implementation follow-up.
- `staff_officer`: Staff Officer, draft creation, version uploads, metadata, and operational evidence.

Roles are read from public tables, not from a hardcoded app-side user creation form:

- `app_roles`
- `user_profiles`

Users are created in Supabase Auth. A trigger in `supabase/migrations/20260702020000_create_user_profiles_roles.sql` creates a `user_profiles` row automatically with default role `staff_officer`. Admins can then change `role_code` in the public `user_profiles` table.

`context/AuthContext.tsx` loads `user_profiles` and falls back to auth metadata/email role inference through `lib/roleUtils.ts` when a profile is unavailable.

## Cloudflare R2

R2 uploads go through the Worker in `r2-proxy-worker/`; do not expose R2 secret keys in browser code.

Expected env keys:

- `VITE_R2_ACCOUNT_ID`
- `VITE_R2_BUCKET_NAME`
- `VITE_R2_PUBLIC_URL`
- `VITE_R2_WORKER_URL`

The current bucket is `dashboard-lingkungan`, and the Worker URL is read from `VITE_R2_WORKER_URL`.

R2 upload helpers:

- Evidence: `uploadEvidence()` in `lib/supabase.ts`.
- Archive document softfiles: `uploadDocumentFile()` in `lib/supabase.ts`.
- Asset files: `uploadAssetFile()` in `lib/supabase.ts`.
- PKS/MOU draft files: `uploadCooperationDocumentFile()` in `lib/supabase.ts`.

Worker upload limit is enforced in `r2-proxy-worker/src/index.ts`. App-side validation must stay aligned with Worker-side limits.

## Asset Page

The Asset page is a general team file cabinet for arbitrary team files in R2, not only formal documents.

- Page: `pages/AssetPage.tsx`
- Supabase table migration: `supabase/migrations/20260608045633_create_assets_table.sql`
- Upload helper: `uploadAssetFile(file, folderName?)`
- Storage key shape uses `assets/...`.
- Batch uploads should appear as one folder/group card, not many unrelated flat rows.
- Folder grouping uses `category` first, then `storage_key`, then fallback labels like `Tanpa Folder`.

Danta.AI can read Asset metadata through the chatbot snapshot path. If the AI misses asset data, inspect `lib/chatbotData.ts`, `lib/chatbotAssetUtils.ts`, and the source selection logic before changing the Asset page.

## Danta.AI

- UI component: `components/AIChatbot.tsx`
- Snapshot/context builder: `lib/chatbotData.ts`
- Asset helpers: `lib/chatbotAssetUtils.ts`
- Report agent/types: `lib/reportAgent.ts` and `lib/chatbotTypes.ts` when present.
- Weekly report generation: `lib/weeklyReportUtils.ts`
- Gemini service: `lib/geminiService.ts`

Danta.AI may prepare actions, but report generation and other mutations should wait for explicit user confirmation. Preserve this confirmation pattern when adding new agent actions.

For AI coverage questions such as whether Danta.AI reads a page, trace the real snapshot/query path first. Do not answer only from UI presence.

## Dokumen Archive

`pages/DokumenPage.tsx` is the archive/category document area. It is for document categories, metadata, links, softfile/hardfile status, and archive search/filtering.

Do not put PKS/MOU workflow UI back into `pages/DokumenPage.tsx`. PKS/MOU has its own workspace because it has approval state, evidence versions, project task impact, and role-specific inbox behavior.

## PKS/MOU Workspace

PKS/MOU is its own workspace page and must stay separate from the archive-only Dokumen page.

- Route enum: `PageView.COOPERATION_DOCUMENTS`
- Sidebar label: `PKS/MOU`
- Page component: `pages/CooperationDocumentsPage.tsx`
- Workflow helper: `lib/cooperationWorkflow.ts`
- Supabase operations: `lib/supabase.ts`
- Main migration: `supabase/migrations/20260702010000_create_cooperation_documents.sql`

Correct order:

1. Staff Officer creates the initial draft and uploads `Draft v1`.
2. Status becomes `draft-internal`.
3. Project Head reviews substance.
4. Project Manager validates completeness and portfolio readiness.
5. VP Lingkungan approves.
6. Document moves through final/signing states.
7. Signed document becomes evidence and can support active/monitoring project tasks.

The page must not show sample PKS/MOU data when Supabase is empty. `COOPERATION_DEMO_DOCUMENTS` may remain for helper tests, but production UI must render an empty state until real rows exist.

## PKS/MOU Project Weighting

- Not every project has PKS/MOU.
- If a project has PKS/MOU, the document pool stays fixed at 20 percent.
- Multiple PKS/MOU documents split that 20 percent equally by default.
- Project task status should follow PKS/MOU document status automatically.
- Uploaded document versions display as evidence.

## PKS/MOU R2 Storage

PKS/MOU draft files must be stored in Cloudflare R2 through the existing Worker, not Supabase Storage.

Use `uploadCooperationDocumentFile()` in `lib/supabase.ts`. It writes to this key shape:

```text
documents/pks-mou/<jenis>/<tahun>/<bulan>/<timestamp>_<nama_file>
```

Example:

```text
documents/pks-mou/pks/2026/07/1782950000000_draft_pks.pdf
```

The returned `storageKey` must be saved into `cooperation_document_versions.storage_key`, and the public URL must be saved into `file_url`.

## Work And Project Progress

`pages/ManageDataNew.tsx` and `pages/WorkPage.tsx` share project-progress concerns but are not the same workflow.

- Manage Data handles project/activity/SCurve data management.
- Work handles work project setup, daily progress, plan schedules, and operational updates.
- Evidence upload is handled by `uploadEvidence()` and can use R2 when configured.

Be careful with broad progress changes: dashboard, Gantt, calendar, Work, and Close Project may all consume overlapping project data.

## Close Project

`pages/CloseProjectPage.tsx` handles closure/archive workflows and generated project outputs. When changing closure logic, inspect any Supabase status updates and generated document/export helpers before editing UI only.

## Relevant Recent PKS/MOU Commits

- `4d215d0 feat: add cooperation document role workflow`
- `6ceb6b1 fix: harden cooperation migration policies`
- `7c32ff9 feat: read user roles from public profiles`
- `7c2242c feat: auto-create default user profiles`
- `a4eb206 feat: split pks mou workspace from document archive`
- `623b91a fix: remove pks mou demo fallback data`
- `66c42c1 feat: allow staff to draft pks mou documents`
- `b6868fb feat: store pks mou drafts in r2 prefix`
- `ca3497a docs: document pks mou workflow agent notes`

## Performance And Build Configuration

### Tailwind CSS

Tailwind CSS is processed at **build time** via the `@tailwindcss/vite` plugin (Tailwind v4). The CSS entry point is `styles/tailwind.css`, imported in `index.tsx`. Do **not** re-add the Tailwind CDN `<script>` tag to `index.html` — that was the primary cause of production slowness (300KB render-blocking runtime JS).

### Deploy Target

Production deploys to **Vercel** (`project-lingkungan.vercel.app`). `vercel.json` provides SPA rewrite rules and immutable cache headers for hashed assets. Do not use `@cloudflare/vite-plugin` — it was removed because it conflicts with Vercel deploys.

### Vite Build

`vite.config.ts` uses `manualChunks` to group vendor libraries into stable, cacheable chunks:

- `vendor-recharts`: recharts + d3-* libraries.
- `vendor-supabase`: @supabase/* SDK.
- `vendor-pdf`: jspdf, pdf-lib, pdfjs-dist, html2canvas.
- `vendor-calendar`: react-big-calendar + moment.
- `vendor-icons`: lucide-react (consolidated from 30+ tiny chunks).
- `vendor-xlsx`: xlsx library.
- `vendor-dnd`: react-dnd.

Do not remove `manualChunks` or the chunk count will balloon back to 60+ files.

### Cooperation Documents Cache

`hooks/useCooperationDocuments.ts` has a module-level cache with 30-second TTL and in-flight deduplication. Multiple components (VpDashboard, PmDashboard, PhDashboard, ActionInbox) share one Supabase fetch instead of each making independent requests.

After mutations to cooperation documents, call `invalidateCooperationDocumentsCache()` (exported from the same hook file) to force a re-fetch on next mount.

### Auth Timeout

`context/AuthContext.tsx` has a 3-second hard ceiling on the entire auth init chain (`getSession` + `loadUserProfile`). The timeout is NOT cleared when `getSession` returns — it only clears when the full chain completes. If Supabase auth does not respond within 3 seconds, the app proceeds without a session. Do not increase this beyond 3 seconds — users should not stare at a blank screen.

The `loadUserProfile` query itself has a 2-second `AbortSignal.timeout`. DataContext parallel queries have a 5-second `AbortSignal.timeout`. Cooperation document queries have a 5-second `AbortSignal.timeout`. These prevent any individual query from hanging indefinitely.

### PWA Service Worker

PWA workbox uses `NetworkFirst` for Supabase API calls with a 5-second network timeout. Precache covers 46 entries (~4.7 MB). The `maximumFileSizeToCacheInBytes` is set to 3 MB.

## Design System

The visual language is documented in `DESIGN.md`. Key rules for agents:

- **Action Blue** (`#0066cc`) is the only interactive/selected color. Do not use emerald, indigo, or any other color for buttons, active nav, or selection states.
- **Emerald/Amber/Red** are semantic status only (on-track / at-risk / late). Always pair with an icon.
- **Sidebar active state**: `bg-blue-50 text-[#0066cc]` — already migrated from emerald.
- **StatTile icon chip**: `bg-blue-50 text-[#0066cc]` — already migrated from indigo.
- **Radius scale**: `rounded-full` (pills), `rounded-xl` (cards), `rounded-lg` (controls), `rounded-md` (chips). Do not freestyle radii.
- **No shadow on buttons/badges/inputs.** Cards use `shadow-sm` + `border border-slate-200`. Hover uses `hover:border-slate-300`, not `hover:shadow-md`.
- **Typography**: Inter only. `tracking-tight` on headings and KPI numbers. `tabular-nums` on all data figures. Poppins is loaded but retired from UI — do not use it in new components.
- **Color constants**: `constants.ts` exports `COLORS` object with `action`, `statusPositive`, `statusWarning`, `statusDanger`, `chartActual`, `chartPlan`, etc. Use these in JS/chart code, not raw hex.

### UI Component Library

Reusable design-system components live in `components/ui/`:

- `Button.tsx`: Primary (Action Blue), secondary, tertiary, danger variants. All have `active:scale-[0.98]` and `focus-visible:ring-2 ring-[#0071e3]`.
- `Card.tsx`: `bg-white border border-slate-200 rounded-xl shadow-sm`. Optional `title` and `action` props.
- `StatTile.tsx`: KPI card with label, value, icon chip, and optional trend pill. Value uses `text-3xl font-bold tracking-tight tabular-nums`.
- `StatusBadge.tsx`: Pill badge with icon for positive/warning/danger/neutral status.
- `SegmentedTabs.tsx`: Tab component for segmented controls.

Use these components instead of writing inline card/button markup. They enforce DESIGN.md tokens.

## Role-Aware Dashboards

`pages/DashboardNew.tsx` wraps role-specific dashboards in a consistent padding/max-width container (`p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto`). The sub-dashboards are:

- `pages/dashboards/VpDashboard.tsx`: VP Lingkungan view — portfolio stats, approval inbox, status donut, S-curve.
- `pages/dashboards/PmDashboard.tsx`: Project Manager view — validation inbox, at-risk list, project table.
- `pages/dashboards/PhDashboard.tsx`: Project Head view — review inbox, S-curve, at-risk list.
- `pages/dashboards/StaffDashboard.tsx`: Staff Officer view — draft inbox, S-curve, project table.

Dashboard sub-components live in `components/dashboard/`:

- `ActionInbox.tsx`: Role-filtered cooperation document inbox using `useCooperationDocuments` hook.
- `SCurvePanel.tsx`: Aggregated S-curve chart for project portfolio.
- `StatusDonut.tsx`: Pie chart of project health distribution.
- `AtRiskList.tsx`: List of at-risk projects with variance badge.
- `ProjectTable.tsx`: Tabular project list with health status.

Metrics helpers: `utils/dashboardMetrics.ts` exports `atRiskProjects`, `projectVariance`, `latestProgress`, `latestPlanned`, `portfolioSeries`.

Do not add padding inside individual dashboard components — `DashboardNew.tsx` provides the outer padding wrapper.
