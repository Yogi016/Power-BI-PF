# Dokumen Kerja Sama Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-aware Dokumen page workspace for PKS/MOU cooperation documents, including workflow status, version evidence, VP approval gate, and 20% project task weighting rules.

**Architecture:** Add small focused domain helpers for role resolution and cooperation workflow rules, then surface them in `DokumenPage` without replacing the existing document registry. Add a Supabase migration for the future persistent tables, while keeping the UI resilient with local sample data if the migration has not been applied yet.

**Tech Stack:** React 18, TypeScript, Vite, Supabase, lucide-react, existing Tailwind utility styling.

---

### Task 1: Role Model And Auth Exposure

**Files:**
- Modify: `types.ts`
- Create: `lib/roleUtils.ts`
- Modify: `context/AuthContext.tsx`
- Modify: `components/Layout.tsx`

- [ ] **Step 1: Add role types**

Add `UserRole` and `RoleProfile` to `types.ts`:

```ts
export type UserRole = 'vp_lingkungan' | 'project_manager' | 'project_head' | 'staff_officer';

export interface RoleProfile {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
}
```

- [ ] **Step 2: Create role resolver**

Create `lib/roleUtils.ts` with role metadata, label helpers, and `resolveUserRole(user)` that reads `user_metadata.role`, `user_metadata.app_role`, `user_metadata.position`, or email hints. Default to `staff_officer`.

- [ ] **Step 3: Expose role from auth context**

Update `AuthContextType` to include `role` and `roleProfile`, derive both from `user`, and provide them through `AuthContext.Provider`.

- [ ] **Step 4: Show role badge in layout**

Update `components/Layout.tsx` desktop and mobile headers to show the resolved role label. Keep all existing menus visible, especially `Dokumen`.

- [ ] **Step 5: Verify**

Run `./node_modules/.bin/tsc --noEmit --pretty false`. Expected: no TypeScript errors from the role additions.

### Task 2: Cooperation Workflow Domain Helpers

**Files:**
- Modify: `types.ts`
- Create: `lib/cooperationWorkflow.ts`
- Create: `scripts/test-cooperation-workflow.ts`

- [ ] **Step 1: Add cooperation document types**

Add document status, version, approval, linked project, generated task, and view model interfaces to `types.ts`.

- [ ] **Step 2: Implement workflow helpers**

Create `lib/cooperationWorkflow.ts` with:

- `COOPERATION_STATUSES`
- `COOPERATION_TASK_TEMPLATE`
- `COOPERATION_TASK_WEIGHT_DISTRIBUTION`
- `mapCooperationStatusToTaskId(status, hasSignedDocument)`
- `buildCooperationTasks(document)`
- `distributeCooperationDocumentWeights(documents)`
- `redistributeImplementationWeights(activities, hasCooperationDocuments)`
- `getRoleDashboardConfig(role)`
- `buildRoleDocumentInbox(documents, role)`
- `COOPERATION_DEMO_DOCUMENTS`

- [ ] **Step 3: Add verification script**

Create `scripts/test-cooperation-workflow.ts` using Node `assert` to verify:

- 100% implementation weights become 80% proportionally when a cooperation package exists.
- 1/2/3 cooperation documents split the fixed 20% pool correctly.
- `Menunggu Approval VP` activates `approval-vp`.
- Draft/final versions become task evidence.
- Each role gets a different inbox focus.

- [ ] **Step 4: Verify helper behavior**

Run `npx tsx scripts/test-cooperation-workflow.ts`. Expected output includes `cooperation workflow checks passed`.

### Task 3: Supabase Persistence Shape

**Files:**
- Create: `supabase/migrations/20260702010000_create_cooperation_documents.sql`
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add migration**

Create tables:

- `cooperation_documents`
- `cooperation_document_versions`
- `cooperation_document_approvals`
- `cooperation_document_project_links`
- `audit_events`

Use authenticated RLS policies for all operations in this phase, with table comments documenting that record-level policies come after role metadata is deployed.

- [ ] **Step 2: Add Supabase fetch helpers**

Add `fetchCooperationDocuments()` to `lib/supabase.ts`. It should read documents and nested versions/approvals/project links, map snake_case fields to the new TypeScript interfaces, and return `[]` on migration-missing errors so the UI can use the local sample data.

- [ ] **Step 3: Verify**

Run `./node_modules/.bin/tsc --noEmit --pretty false`. Expected: no TypeScript errors from the new Supabase mapper.

### Task 4: Role-Aware Dokumen Workspace UI

**Files:**
- Modify: `pages/DokumenPage.tsx`

- [ ] **Step 1: Load role and cooperation data**

Import `useAuth`, `fetchCooperationDocuments`, and workflow helpers. Load cooperation documents on mount, using `COOPERATION_DEMO_DOCUMENTS` when no persistent records exist.

- [ ] **Step 2: Add role-aware top workspace**

Add a new top section above the existing global search:

- Role badge and role description.
- Metrics for all cooperation documents, VP waiting approval, active documents, and expired/expiring documents.
- Role-specific inbox cards.
- Workflow board/table with document status, project link, pool weight, active task, and version evidence.

- [ ] **Step 3: Preserve existing Dokumen page**

Keep category tabs, global search, upload form, and document table visible. Do not hide the page or menu for any role.

- [ ] **Step 4: Verify UI compile**

Run `./node_modules/.bin/tsc --noEmit --pretty false`. Expected: no TypeScript errors.

### Task 5: Build Verification

**Files:**
- No additional code files.

- [ ] **Step 1: Run domain checks**

Run `npx tsx scripts/test-cooperation-workflow.ts`. Expected: `cooperation workflow checks passed`.

- [ ] **Step 2: Run safe Vite build**

Run `./node_modules/.bin/vite build`. Expected: production build succeeds without running the `prebuild` R2 CORS mutation.

- [ ] **Step 3: Review git diff**

Run `git diff --stat` and inspect touched files. Expected: only role/workflow/document feature files and the implementation plan are changed.
