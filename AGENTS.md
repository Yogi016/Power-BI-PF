# Power-BI-PF Agent Notes

This repo is a Vite + React dashboard for Project Fungsi Lingkungan. Keep visible product copy in Bahasa Indonesia unless the user asks otherwise.

## Safe Verification

- Prefer `./node_modules/.bin/vite build` for verification.
- Avoid `npm run build` unless the user explicitly wants the prebuild side effect, because it runs `tsx scripts/update_r2_cors.ts` and can update or generate Cloudflare R2 CORS configuration.
- For PKS/MOU workflow logic, run `npx tsx scripts/test-cooperation-workflow.ts`.

## Role Model

Operational roles are:

- `vp_lingkungan`: VP Lingkungan, 1 person, executive approval and cross-portfolio risk view.
- `project_manager`: Project Manager, 2 people, portfolio validation and bottleneck review.
- `project_head`: Project Head, 4 people, project substance review and implementation follow-up.
- `staff_officer`: Staff Officer, draft creation, version uploads, metadata, and operational evidence.

Roles are read from public tables, not hardcoded user creation forms:

- `app_roles`
- `user_profiles`

Users are created in Supabase Auth. A trigger in `supabase/migrations/20260702020000_create_user_profiles_roles.sql` creates a `user_profiles` row automatically with default role `staff_officer`. Admins can then change `role_code` in the public `user_profiles` table.

## PKS/MOU Workspace

PKS/MOU is its own workspace page and must stay separate from the archive-only Dokumen page.

- Route enum: `PageView.COOPERATION_DOCUMENTS`
- Sidebar label: `PKS/MOU`
- Page component: `pages/CooperationDocumentsPage.tsx`
- Workflow helper: `lib/cooperationWorkflow.ts`
- Supabase operations: `lib/supabase.ts`
- Main migration: `supabase/migrations/20260702010000_create_cooperation_documents.sql`

Do not put PKS/MOU workflow UI back into `pages/DokumenPage.tsx`. The Dokumen page is only for archive/category document records.

## PKS/MOU Workflow Rules

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

Existing R2 env keys are expected in `.env.local`:

- `VITE_R2_ACCOUNT_ID`
- `VITE_R2_BUCKET_NAME`
- `VITE_R2_PUBLIC_URL`
- `VITE_R2_WORKER_URL`

The current bucket is `dashboard-lingkungan`, and the Worker URL is read from `VITE_R2_WORKER_URL`.

## Supabase Migration Notes

Migration files created for this workflow:

- `supabase/migrations/20260702010000_create_cooperation_documents.sql`
- `supabase/migrations/20260702020000_create_user_profiles_roles.sql`

Apply these only to the correct Supabase project. A prior check found the local `.env.local` Supabase ref differed from the Supabase MCP-accessible project, so do not run migrations through MCP unless the target project ref is confirmed first.

## Relevant Recent Commits

- `4d215d0 feat: add cooperation document role workflow`
- `6ceb6b1 fix: harden cooperation migration policies`
- `7c32ff9 feat: read user roles from public profiles`
- `7c2242c feat: auto-create default user profiles`
- `a4eb206 feat: split pks mou workspace from document archive`
- `623b91a fix: remove pks mou demo fallback data`
- `66c42c1 feat: allow staff to draft pks mou documents`
- `b6868fb feat: store pks mou drafts in r2 prefix`
