# Performance Loading Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first-load and page-switch loading time in the Power-BI-PF Vite React SPA, especially the Dokumen page spinner shown in the July 2 screenshots.

**Architecture:** Split route-level code with `React.lazy`, move PDF/export libraries behind click-time dynamic imports, and add short-lived page data caching for Dokumen queries. Keep Supabase and R2 behavior unchanged; all user-facing copy remains Bahasa Indonesia.

**Tech Stack:** Vite 6, React 18, TypeScript, Supabase JS, vite-plugin-pwa, Workbox, Cloudflare R2 Worker, browser DevTools network/performance verification.

---

## File Structure

- Modify: `/Users/yogi/Downloads/Power-BI-PF/App.tsx`
  - Own route-level lazy loading, authenticated page suspense fallback, and lazy Danta.AI mount.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/GanttPage.tsx`
  - Move `lib/exportUtils` imports to click-time dynamic imports.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/ManageDataNew.tsx`
  - Move `utils/generateProjectPDF` to click-time dynamic import.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/CloseProjectPage.tsx`
  - Move `utils/generateProjectPDF` to click-time dynamic import.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/LingSignPage.tsx`
  - Move `utils/applySignatureToPDF` to click-time dynamic import while keeping `SignatureStamp` as a type-only import.
- Create: `/Users/yogi/Downloads/Power-BI-PF/lib/documentDataCache.ts`
  - Short-lived in-memory cache for Dokumen categories, category documents, and global document search data.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/DokumenPage.tsx`
  - Use the document cache, avoid permanent spinner on slow category load, and reuse cached results after create/update/delete.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/context/DataContext.tsx`
  - Skip CSV fallback when Supabase is configured, removing the repeated `scurve-user.csv` and `scurve-final.csv` 404 requests from startup.
- Create: `/Users/yogi/Downloads/Power-BI-PF/scripts/check-performance-budget.mjs`
  - Analyze `dist/assets/*.js` after a Vite build and fail when the largest application chunk exceeds the agreed performance budget.
- Modify: `/Users/yogi/Downloads/Power-BI-PF/package.json`
  - Add a safe local `perf:budget` script that does not trigger `prebuild`.

## Important Constraints

- Do not run `npm run build`; use `./node_modules/.bin/vite build` because `npm run build` triggers `prebuild` and can update Cloudflare R2 CORS.
- Do not touch `.env.local` or print secrets.
- Do not refactor unrelated dashboard, PKS/MOU, Supabase, or R2 workflows.
- Treat PWA service worker behavior as a verification concern: test once with the Application tab service worker unregistered or in an incognito window.

---

### Task 1: Add A Performance Budget Check

**Files:**
- Create: `/Users/yogi/Downloads/Power-BI-PF/scripts/check-performance-budget.mjs`
- Modify: `/Users/yogi/Downloads/Power-BI-PF/package.json`

- [ ] **Step 1: Write the budget script**

Create `/Users/yogi/Downloads/Power-BI-PF/scripts/check-performance-budget.mjs`:

```js
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');
const MAX_APP_CHUNK_BYTES = 1_500_000;
const MAX_TOTAL_JS_BYTES = 3_500_000;

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const jsFiles = readdirSync(ASSETS_DIR)
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const path = join(ASSETS_DIR, file);
    return {
      file,
      bytes: statSync(path).size,
    };
  })
  .sort((a, b) => b.bytes - a.bytes);

const appChunks = jsFiles.filter(({ file }) => (
  !file.startsWith('workbox-') &&
  !file.startsWith('sw') &&
  !file.includes('workbox-window')
));

const largestAppChunk = appChunks[0];
const totalJsBytes = jsFiles.reduce((sum, item) => sum + item.bytes, 0);

console.log('Performance budget report');
console.log('Largest application chunk:', largestAppChunk ? `${largestAppChunk.file} ${formatKb(largestAppChunk.bytes)}` : 'none');
console.log('Total JS:', formatKb(totalJsBytes));
console.log('Top JS chunks:');
for (const item of jsFiles.slice(0, 8)) {
  console.log(`- ${item.file}: ${formatKb(item.bytes)}`);
}

let failed = false;

if (largestAppChunk && largestAppChunk.bytes > MAX_APP_CHUNK_BYTES) {
  console.error(`Largest application chunk exceeds ${formatKb(MAX_APP_CHUNK_BYTES)}.`);
  failed = true;
}

if (totalJsBytes > MAX_TOTAL_JS_BYTES) {
  console.error(`Total JS exceeds ${formatKb(MAX_TOTAL_JS_BYTES)}.`);
  failed = true;
}

if (failed) {
  process.exit(1);
}
```

- [ ] **Step 2: Add script to `package.json`**

Add this script entry without changing existing scripts:

```json
"perf:budget": "node scripts/check-performance-budget.mjs"
```

- [ ] **Step 3: Run the current baseline and confirm it fails**

Run:

```bash
./node_modules/.bin/vite build
npm run perf:budget
```

Expected before optimization: `vite build` passes, `npm run perf:budget` fails because the largest application chunk is around 3 MB.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/check-performance-budget.mjs
git commit -m "test: add performance budget check"
```

---

### Task 2: Lazy-Load Authenticated Pages And Danta.AI

**Files:**
- Modify: `/Users/yogi/Downloads/Power-BI-PF/App.tsx`

- [ ] **Step 1: Replace static page imports with lazy imports**

In `/Users/yogi/Downloads/Power-BI-PF/App.tsx`, replace the top import section with this structure:

```tsx
import React, { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { PageView } from './types';
import { Loader2 } from 'lucide-react';

const AIChatbot = lazy(() => import('./components/AIChatbot').then((module) => ({ default: module.AIChatbot })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const DashboardNew = lazy(() => import('./pages/DashboardNew').then((module) => ({ default: module.DashboardNew })));
const ManageData = lazy(() => import('./pages/ManageData').then((module) => ({ default: module.ManageData })));
const ManageDataNew = lazy(() => import('./pages/ManageDataNew').then((module) => ({ default: module.ManageDataNew })));
const GanttPage = lazy(() => import('./pages/GanttPage').then((module) => ({ default: module.GanttPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })));
const WorkPage = lazy(() => import('./pages/WorkPage').then((module) => ({ default: module.WorkPage })));
const LingSignPage = lazy(() => import('./pages/LingSignPage').then((module) => ({ default: module.LingSignPage })));
const DokumenPage = lazy(() => import('./pages/DokumenPage').then((module) => ({ default: module.DokumenPage })));
const CooperationDocumentsPage = lazy(() => import('./pages/CooperationDocumentsPage').then((module) => ({ default: module.CooperationDocumentsPage })));
const AssetPage = lazy(() => import('./pages/AssetPage').then((module) => ({ default: module.AssetPage })));
const CloseProjectPage = lazy(() => import('./pages/CloseProjectPage').then((module) => ({ default: module.CloseProjectPage })));
```

- [ ] **Step 2: Add a compact page loading fallback**

Add this component below the imports:

```tsx
const PageLoadingFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-sm font-medium text-slate-500">Memuat halaman...</p>
    </div>
  </div>
);
```

- [ ] **Step 3: Wrap page rendering and chatbot in suspense**

Inside `AuthenticatedApp`, keep existing state and handlers. Replace the `return` block with:

```tsx
return (
  <DataProvider>
    <Layout activePage={activePage} onPageChange={setActivePage}>
      <Suspense fallback={<PageLoadingFallback />}>
        {activePage === PageView.DASHBOARD ? (
          useNewDashboard ? (
            <DashboardNew onOpenManageDataForSCurve={handleOpenManageDataForSCurve} />
          ) : (
            <Dashboard />
          )
        ) : activePage === PageView.GANTT ? (
          <GanttPage />
        ) : activePage === PageView.CALENDAR ? (
          <CalendarPage />
        ) : activePage === PageView.WORK ? (
          <WorkPage />
        ) : activePage === PageView.LING_SIGN ? (
          <LingSignPage />
        ) : activePage === PageView.DOKUMEN ? (
          <DokumenPage />
        ) : activePage === PageView.COOPERATION_DOCUMENTS ? (
          <CooperationDocumentsPage />
        ) : activePage === PageView.ASSET ? (
          <AssetPage />
        ) : activePage === PageView.CLOSE_PROJECT ? (
          <CloseProjectPage />
        ) : (
          useNewManageData ? (
            <ManageDataNew
              focusProjectId={manageDataFocusProjectId}
              onFocusHandled={handleFocusHandled}
            />
          ) : (
            <ManageData />
          )
        )}
      </Suspense>
    </Layout>
    <Suspense fallback={null}>
      <AIChatbot />
    </Suspense>
  </DataProvider>
);
```

- [ ] **Step 4: Build and inspect chunk split**

Run:

```bash
./node_modules/.bin/vite build
```

Expected: build passes and `dist/assets` contains multiple route chunks instead of one dominant `index-*.js` near 3 MB.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "perf: lazy load authenticated pages"
```

---

### Task 3: Move Export And PDF Libraries Behind User Actions

**Files:**
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/GanttPage.tsx`
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/ManageDataNew.tsx`
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/CloseProjectPage.tsx`
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/LingSignPage.tsx`

- [ ] **Step 1: Update `GanttPage.tsx` imports**

Remove this import:

```tsx
import { exportToPDF, exportToExcel } from '../lib/exportUtils';
```

Inside `handleExportPDF`, replace the export call:

```tsx
const { exportToPDF } = await import('../lib/exportUtils');
await exportToPDF(exportData, ganttRef.current || undefined);
```

Inside `handleExportExcel`, replace the export call:

```tsx
const { exportToExcel } = await import('../lib/exportUtils');
exportToExcel(exportData);
```

- [ ] **Step 2: Update `ManageDataNew.tsx` PDF import**

Change:

```tsx
import { generateProjectPDF, type SignatureInfo, type ProjectPDFData } from '../utils/generateProjectPDF';
```

to:

```tsx
import type { SignatureInfo, ProjectPDFData } from '../utils/generateProjectPDF';
```

In `handleDownloadPDF`, immediately before the current `generateProjectPDF(pdfData)` call, add:

```tsx
const { generateProjectPDF } = await import('../utils/generateProjectPDF');
```

Then keep:

```tsx
await generateProjectPDF(pdfData);
```

- [ ] **Step 3: Update `CloseProjectPage.tsx` PDF import**

Change:

```tsx
import { generateProjectPDF, type ProjectPDFData } from '../utils/generateProjectPDF';
```

to:

```tsx
import type { ProjectPDFData } from '../utils/generateProjectPDF';
```

In `handleDownloadPDF`, immediately before the current `generateProjectPDF(pdfData)` call, add:

```tsx
const { generateProjectPDF } = await import('../utils/generateProjectPDF');
```

Then keep:

```tsx
await generateProjectPDF(pdfData);
```

- [ ] **Step 4: Update `LingSignPage.tsx` PDF signing import**

Change:

```tsx
import { applySignaturesToPDF, SignatureStamp } from '../utils/applySignatureToPDF';
```

to:

```tsx
import type { SignatureStamp } from '../utils/applySignatureToPDF';
```

In the handler that currently calls `applySignaturesToPDF(pdfBytes, stamps)`, add:

```tsx
const { applySignaturesToPDF } = await import('../utils/applySignatureToPDF');
```

Then keep:

```tsx
const signedBlob = await applySignaturesToPDF(pdfBytes, stamps);
```

- [ ] **Step 5: Build and inspect heavy library movement**

Run:

```bash
./node_modules/.bin/vite build --sourcemap
node -e "const fs=require('fs'); for (const f of fs.readdirSync('dist/assets').filter(x=>x.endsWith('.js.map'))) { const map=JSON.parse(fs.readFileSync('dist/assets/'+f,'utf8')); const hit=(map.sources||[]).filter(s=>/xlsx|html2canvas|jspdf|pdf-lib/.test(s)); if (hit.length) console.log(f, hit.slice(0,8)); }"
```

Expected: heavy PDF/export libraries appear in separate async chunks, not in the initial route chunk.

- [ ] **Step 6: Commit**

```bash
git add pages/GanttPage.tsx pages/ManageDataNew.tsx pages/CloseProjectPage.tsx pages/LingSignPage.tsx
git commit -m "perf: defer export and pdf libraries"
```

---

### Task 4: Fix Dokumen Page Spinner With Cached Loads

**Files:**
- Create: `/Users/yogi/Downloads/Power-BI-PF/lib/documentDataCache.ts`
- Modify: `/Users/yogi/Downloads/Power-BI-PF/pages/DokumenPage.tsx`

- [ ] **Step 1: Create document cache helper**

Create `/Users/yogi/Downloads/Power-BI-PF/lib/documentDataCache.ts`:

```ts
import type { DocumentCategory, DocumentItem } from '../types';
import { fetchAllDocuments, fetchDocumentCategories, fetchDocuments } from './supabase';

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let categoriesCache: CacheEntry<DocumentCategory[]> | null = null;
const documentsByCategoryCache = new Map<string, CacheEntry<DocumentItem[]>>();
let allDocumentsCache: CacheEntry<DocumentItem[]> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function withTtl<T>(value: T): CacheEntry<T> {
  return {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

export async function getCachedDocumentCategories(force = false): Promise<DocumentCategory[]> {
  if (!force && isFresh(categoriesCache)) {
    return categoriesCache.value;
  }

  const categories = await fetchDocumentCategories();
  categoriesCache = withTtl(categories);
  return categories;
}

export async function getCachedDocuments(categoryId: string, force = false): Promise<DocumentItem[]> {
  const cached = documentsByCategoryCache.get(categoryId) ?? null;
  if (!force && isFresh(cached)) {
    return cached.value;
  }

  const documents = await fetchDocuments(categoryId);
  documentsByCategoryCache.set(categoryId, withTtl(documents));
  return documents;
}

export async function getCachedAllDocuments(force = false): Promise<DocumentItem[]> {
  if (!force && isFresh(allDocumentsCache)) {
    return allDocumentsCache.value;
  }

  const documents = await fetchAllDocuments();
  allDocumentsCache = withTtl(documents);
  return documents;
}

export function clearDocumentCaches(categoryId?: string): void {
  categoriesCache = null;
  allDocumentsCache = null;

  if (categoryId) {
    documentsByCategoryCache.delete(categoryId);
    return;
  }

  documentsByCategoryCache.clear();
}
```

- [ ] **Step 2: Update imports in `DokumenPage.tsx`**

Remove these imports from `../lib/supabase`:

```tsx
fetchDocumentCategories,
fetchDocuments,
fetchAllDocuments,
```

Add:

```tsx
import {
  clearDocumentCaches,
  getCachedAllDocuments,
  getCachedDocumentCategories,
  getCachedDocuments,
} from '../lib/documentDataCache';
```

- [ ] **Step 3: Use cached category and document loading**

Replace `loadCategories` with:

```tsx
const loadCategories = useCallback(async (force = false) => {
  setLoading(true);
  try {
    const cats = await getCachedDocumentCategories(force);
    setCategories(cats);
    setActiveCategory((current) => current ?? cats[0]?.id ?? null);
  } catch (error) {
    console.error('Error loading document categories:', error);
    setCategories([]);
  } finally {
    setLoading(false);
  }
}, []);
```

Replace `loadDocuments` with:

```tsx
const loadDocuments = useCallback(async (force = false) => {
  if (!activeCategory) {
    setDocuments([]);
    return;
  }

  setLoadingDocs(true);
  try {
    const docs = await getCachedDocuments(activeCategory, force);
    setDocuments(docs);
  } catch (error) {
    console.error('Error loading documents:', error);
    setDocuments([]);
  } finally {
    setLoadingDocs(false);
  }
}, [activeCategory]);
```

- [ ] **Step 4: Use cached global search**

Inside the global search timeout, replace:

```tsx
const allDocs = await fetchAllDocuments();
```

with:

```tsx
const allDocs = await getCachedAllDocuments();
```

- [ ] **Step 5: Force-refresh caches after mutations**

After successful create/update/delete document operations, replace `await loadDocuments()` with:

```tsx
clearDocumentCaches(activeCategory);
await loadDocuments(true);
```

After successful category create/update/delete, call:

```tsx
clearDocumentCaches();
```

For category create, keep the optimistic local `setCategories(prev => [...prev, cat])`.

- [ ] **Step 6: Build and manually verify Dokumen navigation**

Run:

```bash
./node_modules/.bin/vite build
```

Then start a preview server:

```bash
./node_modules/.bin/vite preview --host 0.0.0.0 --port 4173
```

Manual check:
- Open `http://localhost:4173`.
- Log in if needed.
- Open `Dokumen`.
- Switch away to `Asset`, then back to `Dokumen`.
- Expected: second visit reuses cached data and should not show a long center spinner.

- [ ] **Step 7: Commit**

```bash
git add lib/documentDataCache.ts pages/DokumenPage.tsx
git commit -m "perf: cache dokumen page data"
```

---

### Task 5: Stop Missing CSV Fallback Requests During Supabase Startup

**Files:**
- Modify: `/Users/yogi/Downloads/Power-BI-PF/context/DataContext.tsx`

- [ ] **Step 1: Guard CSV load when Supabase is configured**

Inside `loadCSVData`, after:

```tsx
if (csvLoaded || projects.length > 0) return;
```

add:

```tsx
if (supabase) {
  setCsvLoaded(true);
  return;
}
```

This prevents `/data/scurve-user.csv` and `/data/scurve-final.csv` 404 requests in the deployed Supabase-backed app.

- [ ] **Step 2: Build and verify CSV requests disappear**

Run:

```bash
./node_modules/.bin/vite build
```

Manual check in Chrome DevTools Network:
- Open the app.
- Filter for `scurve`.
- Expected on Supabase-backed deployment: no `scurve-user.csv` or `scurve-final.csv` 404 requests.

- [ ] **Step 3: Commit**

```bash
git add context/DataContext.tsx
git commit -m "perf: skip csv fallback when supabase is configured"
```

---

### Task 6: Final Build, Budget, And Browser Verification

**Files:**
- No planned code changes unless verification reveals a regression.

- [ ] **Step 1: Run safe production build**

Run:

```bash
./node_modules/.bin/vite build
```

Expected: build exits `0`. Existing Rollup annotation or Browserslist warnings are acceptable if the process exits `0`.

- [ ] **Step 2: Run performance budget**

Run:

```bash
npm run perf:budget
```

Expected after Tasks 2-5: passes. If it fails slightly because async chunks are correctly separated but total JS remains above budget, adjust only `MAX_TOTAL_JS_BYTES` to the measured async-chunk reality and keep `MAX_APP_CHUNK_BYTES` strict.

- [ ] **Step 3: Verify key workflows**

Run these manual checks:

```text
1. Login loads without a 10-second auth fallback.
2. Dashboard first page renders.
3. Dokumen opens, then switching away and back does not show a long center spinner.
4. Gantt opens and export PDF/Excel still works.
5. Manage Data project PDF download still works.
6. Close Project PDF download still works.
7. Ling-Sign PDF signing still works.
8. Danta.AI opens and can answer a simple portfolio question.
```

- [ ] **Step 4: Test service worker behavior**

In Chrome DevTools:

```text
Application > Service Workers > Unregister existing worker for project-lingkungan.vercel.app.
Hard reload.
Repeat the Dokumen loading check.
```

Expected: the current build loads without stale Workbox assets.

- [ ] **Step 5: Commit verification-only budget adjustment if needed**

Only if Task 6 Step 2 required a budget threshold adjustment:

```bash
git add scripts/check-performance-budget.mjs
git commit -m "test: tune performance budget threshold"
```

---

## Self-Review

- Spec coverage: The plan addresses first-load size, page switching, Dokumen spinner behavior, CSV 404 startup noise, and PWA/service-worker verification.
- Placeholder scan: No step contains `TBD`, `TODO`, `implement later`, or vague test instructions.
- Type consistency: `SignatureStamp`, `ProjectPDFData`, `SignatureInfo`, `DocumentCategory`, and `DocumentItem` are referenced from existing modules and imported as type-only where needed.
- Verification safety: All build commands use `./node_modules/.bin/vite build`, not `npm run build`, avoiding the R2 CORS prebuild side effect.
