# Asset Page R2 Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new authenticated `Asset` page where the team can upload, list, search, open, edit metadata for, and delete arbitrary files stored in Cloudflare R2.

**Architecture:** Keep file bytes in R2 through the existing `VITE_R2_WORKER_URL` proxy and store searchable metadata in a new Supabase `assets` table. The page follows the current SPA pattern: add `PageView.ASSET`, render `pages/AssetPage.tsx` from `App.tsx`, and add desktop/mobile navigation entries in `components/Layout.tsx`.

**Tech Stack:** React 18, Vite, TypeScript, Supabase JS, Cloudflare R2 Worker, Tailwind CSS, lucide-react.

---

## File Structure

- Create: `supabase/migrations/20260608045633_create_assets_table.sql`
  - Defines the `assets` metadata table, indexes, `updated_at` trigger, and RLS policy consistent with current document tables.
- Modify: `types.ts`
  - Adds `PageView.ASSET` and `AssetItem`.
- Modify: `lib/supabase.ts`
  - Adds size-only validation for arbitrary asset file types.
  - Adds `uploadAssetFile`, `fetchAssets`, `createAsset`, `updateAsset`, and `deleteAsset`.
  - Expands `deleteStorageFileByUrl` bucket type to support `assets`.
- Create: `pages/AssetPage.tsx`
  - Provides the full Asset UI: upload area, metadata fields, asset list, search/filter, open link, edit, and delete.
- Modify: `App.tsx`
  - Imports and renders `AssetPage`.
- Modify: `components/Layout.tsx`
  - Adds the Asset item to desktop sidebar and mobile bottom navigation.
- Optional modify: `lib/chatbotData.ts`
  - Only do this if Asset files should be searchable by Danta.AI in the first release.

## Assumptions

- R2 is mandatory for Asset uploads. If `VITE_R2_WORKER_URL` or `VITE_R2_PUBLIC_URL` is missing, upload should fail with a clear UI error instead of silently falling back to Supabase Storage.
- Any file format is allowed, but the current shared R2 Worker limit is 100 MB. App-side validation should enforce the same 100 MB cap.
- Assets are team-wide, not project-specific, unless a later request adds project/activity linking.
- Metadata is available only to authenticated app users. The Asset page is behind login, so the table should not grant direct Data API access to `anon`.

---

### Task 1: Add Asset Metadata Table

**Files:**
- Create: `supabase/migrations/20260608045633_create_assets_table.sql`

- [ ] **Step 1: Create migration**

Create the migration with `supabase migration new create_assets_table`, then fill `supabase/migrations/20260608045633_create_assets_table.sql` with:

```sql
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint NOT NULL DEFAULT 0,
  category text,
  description text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_file_name ON assets USING gin (to_tsvector('simple', file_name));

CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_assets_updated_at();

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users for assets" ON assets
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assets TO authenticated;
```

- [ ] **Step 2: Review migration locally**

Run:

```bash
sed -n '1,220p' supabase/migrations/20260608045633_create_assets_table.sql
```

Expected: file contains one `assets` table, three indexes, one trigger, RLS enabled, one authenticated-only policy, and explicit Data API grants for `authenticated`.

- [ ] **Step 3: Apply migration in Supabase**

Apply `supabase/migrations/20260608045633_create_assets_table.sql` using the project's Supabase migration flow or SQL editor.

Expected: table `assets` exists and authenticated app users can select/insert/update/delete assets through Supabase Data API.

---

### Task 2: Add Types

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add Asset page enum**

Change `PageView` in `types.ts` to include:

```ts
export enum PageView {
  DASHBOARD = 'dashboard',
  MANAGE_DATA = 'manage_data',
  CLOSE_PROJECT = 'close_project',
  GANTT = 'gantt',
  CALENDAR = 'calendar',
  WORK = 'work',
  LING_SIGN = 'ling_sign',
  DOKUMEN = 'dokumen',
  ASSET = 'asset',
}
```

- [ ] **Step 2: Add Asset metadata interface**

Add near the document interfaces in `types.ts`:

```ts
export interface AssetItem {
  id: string;
  fileName: string;
  fileUrl: string;
  storageKey: string;
  mimeType?: string | null;
  fileSize: number;
  category?: string | null;
  description?: string | null;
  uploadedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
```

- [ ] **Step 3: Verify TypeScript syntax**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected before later tasks: TypeScript should still compile, because no code references `PageView.ASSET` yet.

---

### Task 3: Add R2 Asset Helpers

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Import AssetItem**

Change the first import from:

```ts
import { Project, SCurveDataPoint, ActivityData, ProjectMetrics, WorkProject, WorkDailyData, DocumentCategory, DocumentItem } from '../types';
```

to:

```ts
import { Project, SCurveDataPoint, ActivityData, ProjectMetrics, WorkProject, WorkDailyData, DocumentCategory, DocumentItem, AssetItem } from '../types';
```

- [ ] **Step 2: Add asset size constant and size-only validation**

Below the existing upload size constants:

```ts
const MAX_EVIDENCE_SIZE_MB = 100;
const MAX_DOCUMENT_SIZE_MB = 100;
const MAX_ASSET_SIZE_MB = 100;
```

Below `validateFile`, add:

```ts
function validateFileSize(file: File, maxSizeMB: number): void {
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi batas ${maxSizeMB}MB. Ukuran saat ini: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
  }
}
```

- [ ] **Step 3: Expand delete helper bucket type**

Change:

```ts
export async function deleteStorageFileByUrl(publicUrl: string, bucketType: 'evidence' | 'dokumen' = 'evidence'): Promise<boolean> {
```

to:

```ts
export async function deleteStorageFileByUrl(publicUrl: string, bucketType: 'evidence' | 'dokumen' | 'assets' = 'evidence'): Promise<boolean> {
```

- [ ] **Step 4: Add Asset operations**

Add this section after the document upload function:

```ts
// =====================================================
// ASSET OPERATIONS
// =====================================================

function mapAssetRow(row: any): AssetItem {
  return {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    category: row.category,
    description: row.description,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeAssetFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned || 'asset.bin';
}

function buildAssetStorageKey(fileName: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.getTime();
  return `assets/${year}/${month}/${timestamp}_${sanitizeAssetFileName(fileName)}`;
}

export async function uploadAssetFile(file: File): Promise<{ url: string; storageKey: string } | null> {
  try {
    validateFileSize(file, MAX_ASSET_SIZE_MB);

    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;

    if (!workerUrl || !publicUrlBase) {
      throw new Error('Konfigurasi R2 belum lengkap. Periksa VITE_R2_WORKER_URL dan VITE_R2_PUBLIC_URL.');
    }

    const storageKey = buildAssetStorageKey(file.name);
    const response = await fetch(`${workerUrl}/${storageKey}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload via worker failed: ${response.status}`);
    }

    return {
      url: `${publicUrlBase}/${storageKey}`,
      storageKey,
    };
  } catch (error) {
    console.error('Error uploading asset file:', error);
    throw error;
  }
}

export async function fetchAssets(): Promise<AssetItem[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapAssetRow);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return [];
  }
}

export async function createAsset(asset: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetItem | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        file_name: asset.fileName,
        file_url: asset.fileUrl,
        storage_key: asset.storageKey,
        mime_type: asset.mimeType || null,
        file_size: asset.fileSize,
        category: asset.category || null,
        description: asset.description || null,
        uploaded_by: asset.uploadedBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapAssetRow(data);
  } catch (error) {
    console.error('Error creating asset:', error);
    return null;
  }
}

export async function updateAsset(
  id: string,
  updates: Pick<Partial<AssetItem>, 'fileName' | 'category' | 'description'>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const updateData: any = {};
    if (updates.fileName !== undefined) updateData.file_name = updates.fileName;
    if (updates.category !== undefined) updateData.category = updates.category || null;
    if (updates.description !== undefined) updateData.description = updates.description || null;

    const { error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating asset:', error);
    return false;
  }
}

export async function deleteAsset(asset: AssetItem): Promise<boolean> {
  if (!supabase) return false;
  try {
    const storageDeleted = await deleteStorageFileByUrl(asset.fileUrl, 'assets');
    if (!storageDeleted) return false;

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', asset.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting asset:', error);
    return false;
  }
}
```

- [ ] **Step 5: Type-check helper changes**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: PASS. If the project already has unrelated TypeScript issues, capture the exact output before continuing.

---

### Task 4: Build Asset Page UI

**Files:**
- Create: `pages/AssetPage.tsx`

- [ ] **Step 1: Create page component**

Create `pages/AssetPage.tsx` with:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AssetItem } from '../types';
import { createAsset, deleteAsset, fetchAssets, updateAsset, uploadAssetFile } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Notice = { type: 'success' | 'error'; message: string } | null;

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getAssetIcon = (asset: AssetItem) => {
  const mime = asset.mimeType || '';
  const name = asset.fileName.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) return FileImage;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  if (mime.includes('pdf') || /\.(pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx)$/.test(name)) return FileText;
  return File;
};

export const AssetPage: React.FC = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [notice, setNotice] = useState<Notice>(null);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [editForm, setEditForm] = useState({ fileName: '', category: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<AssetItem | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    const rows = await fetchAssets();
    setAssets(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(assets.map(asset => asset.category).filter(Boolean) as string[]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return assets.filter(asset => {
      const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
      const matchesQuery = !query || [
        asset.fileName,
        asset.category || '',
        asset.description || '',
        asset.uploadedBy || '',
      ].some(value => value.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [assets, categoryFilter, searchQuery]);

  const resetUploadForm = () => {
    setSelectedFile(null);
    setCategory('');
    setDescription('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setNotice({ type: 'error', message: 'Pilih file terlebih dahulu.' });
      return;
    }

    setUploading(true);
    setNotice(null);
    try {
      const uploaded = await uploadAssetFile(selectedFile);
      if (!uploaded) throw new Error('Upload gagal.');

      const created = await createAsset({
        fileName: selectedFile.name,
        fileUrl: uploaded.url,
        storageKey: uploaded.storageKey,
        mimeType: selectedFile.type || 'application/octet-stream',
        fileSize: selectedFile.size,
        category: category.trim() || null,
        description: description.trim() || null,
        uploadedBy: user?.email || null,
      });

      if (!created) throw new Error('Metadata asset gagal disimpan.');

      await loadAssets();
      resetUploadForm();
      setNotice({ type: 'success', message: 'Asset berhasil diupload ke R2.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload asset gagal.';
      setNotice({ type: 'error', message });
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (asset: AssetItem) => {
    setEditingAsset(asset);
    setEditForm({
      fileName: asset.fileName,
      category: asset.category || '',
      description: asset.description || '',
    });
  };

  const handleUpdate = async () => {
    if (!editingAsset || !editForm.fileName.trim()) return;
    const ok = await updateAsset(editingAsset.id, {
      fileName: editForm.fileName.trim(),
      category: editForm.category.trim() || null,
      description: editForm.description.trim() || null,
    });
    if (ok) {
      setEditingAsset(null);
      await loadAssets();
      setNotice({ type: 'success', message: 'Metadata asset berhasil diperbarui.' });
    } else {
      setNotice({ type: 'error', message: 'Metadata asset gagal diperbarui.' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteAsset(deleteTarget);
    if (ok) {
      setDeleteTarget(null);
      await loadAssets();
      setNotice({ type: 'success', message: 'Asset berhasil dihapus dari R2 dan database.' });
    } else {
      setNotice({ type: 'error', message: 'Asset gagal dihapus.' });
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Team Asset</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Asset</h1>
            <p className="mt-1 text-sm text-slate-500">Upload dan kelola file tim yang disimpan di R2.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total Asset</p>
            <p className="text-xl font-bold text-slate-900">{assets.length}</p>
          </div>
        </div>

        {notice && (
          <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} className="ml-auto rounded p-0.5 hover:bg-white/60" aria-label="Tutup notifikasi">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <label className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
              selectedFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
            }`}>
              {selectedFile ? (
                <div className="flex max-w-full flex-col items-center gap-2">
                  <FileText className="h-9 w-9 text-emerald-600" />
                  <p className="max-w-full truncate text-sm font-semibold text-slate-900">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                  <button
                    type="button"
                    onClick={event => {
                      event.preventDefault();
                      setSelectedFile(null);
                    }}
                    className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    <X size={13} />
                    Ganti file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Upload className="h-10 w-10 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">Klik untuk pilih file</p>
                  <p className="text-xs">Semua format file, maksimal 100 MB.</p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                onChange={event => setSelectedFile(event.target.files?.[0] || null)}
              />
            </label>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
                <input
                  value={category}
                  onChange={event => setCategory(event.target.value)}
                  placeholder="Contoh: Kontrak, Foto, Template"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Deskripsi</label>
                <textarea
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Catatan singkat agar file mudah dicari"
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? 'Mengupload...' : 'Upload ke R2'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Cari nama file, kategori, deskripsi..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={event => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">Semua kategori</option>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex h-52 items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Memuat asset...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center px-4 text-center text-slate-500">
              <File className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">Belum ada asset yang cocok.</p>
              <p className="mt-1 text-xs">Upload file pertama atau ubah pencarian.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAssets.map(asset => {
                const Icon = getAssetIcon(asset);
                return (
                  <div key={asset.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{asset.fileName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{formatBytes(asset.fileSize)}</span>
                          <span>{formatDate(asset.createdAt)}</span>
                          {asset.category && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{asset.category}</span>}
                        </div>
                        {asset.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{asset.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <a
                        href={asset.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink size={14} />
                        Buka
                      </a>
                      <a
                        href={asset.fileUrl}
                        download={asset.fileName}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Download size={14} />
                        Unduh
                      </a>
                      <button
                        onClick={() => startEdit(asset)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(asset)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setEditingAsset(null)} />
          <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">Edit Asset</h2>
              <button onClick={() => setEditingAsset(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nama file</label>
                <input
                  value={editForm.fileName}
                  onChange={event => setEditForm(prev => ({ ...prev, fileName: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
                <input
                  value={editForm.category}
                  onChange={event => setEditForm(prev => ({ ...prev, category: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Deskripsi</label>
                <textarea
                  value={editForm.description}
                  onChange={event => setEditForm(prev => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button onClick={() => setEditingAsset(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleUpdate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Hapus asset?</h2>
                <p className="mt-1 text-sm text-slate-500">File akan dihapus dari R2 dan daftar asset.</p>
                <p className="mt-2 break-all text-xs font-medium text-slate-700">{deleteTarget.fileName}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Type-check the page**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

---

### Task 5: Wire Page Into App and Navigation

**Files:**
- Modify: `App.tsx`
- Modify: `components/Layout.tsx`

- [ ] **Step 1: Import AssetPage in App**

Add in `App.tsx`:

```ts
import { AssetPage } from './pages/AssetPage';
```

- [ ] **Step 2: Render AssetPage**

In the authenticated page selection chain, add the Asset branch before the final Manage Data fallback:

```tsx
        ) : activePage === PageView.DOKUMEN ? (
          <DokumenPage />
        ) : activePage === PageView.ASSET ? (
          <AssetPage />
        ) : activePage === PageView.CLOSE_PROJECT ? (
          <CloseProjectPage />
```

- [ ] **Step 3: Import an Asset icon**

In `components/Layout.tsx`, add `FolderArchive` to the lucide import:

```ts
  FileText,
  FolderArchive
} from 'lucide-react';
```

- [ ] **Step 4: Add desktop sidebar item**

Add this button after the Dokumen button in desktop navigation:

```tsx
          <button
            onClick={() => {
              onPageChange(PageView.ASSET);
              closeMobileMenu();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${activePage === PageView.ASSET
              ? 'bg-emerald-50 text-emerald-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed ? 'justify-center' : ''}`}
          >
            <FolderArchive size={20} className={`flex-shrink-0 transition-colors ${activePage === PageView.ASSET ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {!collapsed && <span>Asset</span>}
          </button>
```

- [ ] **Step 5: Add mobile bottom navigation item**

Change the mobile nav grid from:

```tsx
            <div className="grid grid-cols-7 gap-1">
```

to:

```tsx
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
```

Add Asset to the mobile nav array:

```tsx
              { page: PageView.ASSET, icon: <FolderArchive className="h-[18px] w-[18px]" />, label: 'Asset', ariaLabel: 'Asset' },
```

- [ ] **Step 6: Type-check navigation**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: PASS.

---

### Task 6: Verify Build and R2 Flow

**Files:**
- Verify: `lib/supabase.ts`
- Verify: `pages/AssetPage.tsx`
- Verify: `components/Layout.tsx`

- [ ] **Step 1: Run safe production build**

Use Vite directly to avoid the repo's `prebuild` CORS side effect:

```bash
./node_modules/.bin/vite build
```

Expected: build completes successfully.

- [ ] **Step 2: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves the app, usually at `http://localhost:5173`.

- [ ] **Step 3: Manual UI smoke test**

In the app:

```text
1. Login.
2. Open Asset from the sidebar.
3. Confirm the upload panel appears.
4. Upload a small `.txt` or `.csv` file.
5. Confirm the file appears in the list.
6. Open the file link and confirm it resolves through the R2 public URL.
7. Edit category/description and confirm the list updates.
8. Delete the asset and confirm it disappears from the list.
```

Expected: upload stores the object under an R2 key like `assets/2026/06/<timestamp>_filename.ext`, metadata appears in Supabase `assets`, and delete removes both R2 object and metadata row.

- [ ] **Step 4: Oversize validation smoke test**

Attempt to upload a file larger than 100 MB.

Expected: app shows a clear size-limit error before or during upload, and the Worker also rejects oversized uploads with HTTP 413 if bypassed.

---

### Task 7: Optional Danta.AI Asset Search

**Files:**
- Modify: `lib/chatbotData.ts`

- [ ] **Step 1: Decide whether Asset belongs in chatbot context**

If the team wants Danta.AI to answer asset-related questions, add an `asset` source type and fetch `assets` alongside documents/evidence. If Asset is only a file cabinet for now, skip this task.

- [ ] **Step 2: Add asset source shape**

Extend the existing source type union from:

```ts
type SourceType = 'evidence' | 'document';
```

to:

```ts
type SourceType = 'evidence' | 'document' | 'asset';
```

- [ ] **Step 3: Add asset query**

Fetch from Supabase:

```ts
const assetsResult = await safeQuery(
  supabase
    .from('assets')
    .select('id,file_name,file_url,mime_type,file_size,category,description,uploaded_by,created_at')
    .order('created_at', { ascending: false })
    .limit(200),
  'assets'
);
```

- [ ] **Step 4: Add asset matching keywords**

Include keywords:

```ts
/asset|file tim|dokumen tim|template|lampiran umum|r2/i
```

Expected: chatbot can include Asset links as supporting sources when the user asks about team files.

---

## Self-Review

- Spec coverage: The plan creates a new `Asset` page, permits arbitrary file formats, uploads to R2, stores metadata for team use, supports listing/search/open/edit/delete, and keeps the 100 MB limit aligned with the existing Worker.
- Placeholder scan: No incomplete implementation steps remain.
- Type consistency: `AssetItem`, `PageView.ASSET`, `uploadAssetFile`, `fetchAssets`, `createAsset`, `updateAsset`, and `deleteAsset` names are consistent across tasks.
- Risk notes: Deleting an asset deletes the R2 object first, then metadata. If metadata delete fails after R2 delete, a stale row can remain; the UI should show failure and an operator can retry/delete the row. A later hardening pass can add a server-side delete endpoint for transactional cleanup.

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-08-asset-page-r2-upload.md`.

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task and review between tasks.
2. Inline Execution - execute tasks in this session using checkpoints.
