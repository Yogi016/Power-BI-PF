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
