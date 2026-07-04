# Chat JS Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users attach multiple files (fresh uploads to R2 or references to existing Dokumen records) to a Chat JS help request on both compose and reply, with image attachments shown as clickable thumbnails.

**Architecture:** A `help_request_attachments` table (request-scoped, optional `message_id`) with participant RLS. Pure helpers (`groupAttachmentsByMessage`, `isImageAttachment`) are unit-tested. `createHelpRequest`/`postHelpRequestMessage` return the new row id so attachments can be linked. Shared UI (`AttachmentPicker` + `DocumentPicker`) stages drafts; a shared `resolveAttachments` uploads pending files, then rows are inserted. The thread renders attachments per message with image thumbnails.

**Tech Stack:** React 18 + TS, Vite, Supabase JS, R2 via the existing Worker, Tailwind v4, `components/ui`. Tests are `tsx` scripts.

**Verification:** `npx tsx scripts/test-help-requests.ts` → `help-requests OK`; `./node_modules/.bin/vite build` exit 0. The migration is authored only — the user applies it to project `qafozqmwlfenxorshgfl`.

---

## File Structure

- Create `supabase/migrations/20260704010000_create_help_request_attachments.sql`
- Modify `types.ts` — attachment types.
- Modify `lib/helpRequests.ts` + `scripts/test-help-requests.ts` — pure helpers + tests.
- Modify `lib/supabase.ts` — `uploadCoordinationFile`, return-id changes, `addHelpRequestAttachments`, `fetchHelpRequestAttachments`.
- Create `components/coordination/attachmentUpload.ts` — shared `resolveAttachments`.
- Create `components/coordination/DocumentPicker.tsx`
- Create `components/coordination/AttachmentPicker.tsx`
- Modify `components/coordination/CoordinationPanel.tsx` — attachments in ComposeForm.
- Modify `components/coordination/RequestThread.tsx` — attach on reply + render.

---

## Task 1: Migration (authored; user applies)

**Files:**
- Create: `supabase/migrations/20260704010000_create_help_request_attachments.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =====================================================
-- Chat JS attachments: files linked to a help request (initial or per-reply)
-- =====================================================
CREATE TABLE IF NOT EXISTS help_request_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    message_id UUID REFERENCES help_request_messages(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'document')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_attachments_request ON help_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_hr_attachments_message ON help_request_attachments(message_id);

ALTER TABLE help_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY hra_select ON help_request_attachments FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM help_requests r
        WHERE r.id = help_request_attachments.request_id
          AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
    ));
CREATE POLICY hra_insert ON help_request_attachments FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM help_requests r
            WHERE r.id = help_request_attachments.request_id
              AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
        )
    );
```

- [ ] **Step 2: Sanity check**

Run: `grep -c "CREATE POLICY" supabase/migrations/20260704010000_create_help_request_attachments.sql`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260704010000_create_help_request_attachments.sql
git commit -m "feat: add help_request_attachments table and RLS migration"
```

> Do NOT apply automatically. The user runs this SQL in the Supabase SQL Editor of `qafozqmwlfenxorshgfl`.

---

## Task 2: Types

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Append attachment types**

```typescript
export type AttachmentSource = 'upload' | 'document';

export interface HelpRequestAttachment {
  id: string;
  requestId: string;
  messageId: string | null;
  name: string;
  url: string;
  source: AttachmentSource;
  documentId: string | null;
  createdAt: string;
}

// Staged (pre-send) attachment in the composer/reply box.
export interface AttachmentDraft {
  key: string;                // local id for list keys/removal
  name: string;
  source: AttachmentSource;
  file?: File;                // upload: the file to send
  previewUrl?: string;        // upload: object URL for image preview (revoke on removal/unmount)
  url?: string;               // document: the existing file URL
  documentId?: string;        // document: source record id
}
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add attachment types for Chat JS"
```

---

## Task 3: Pure helpers (TDD)

**Files:**
- Modify: `lib/helpRequests.ts`
- Test: `scripts/test-help-requests.ts`

- [ ] **Step 1: Write the failing tests**

In `scripts/test-help-requests.ts`, change the import line
`import { hasUnread, isHelpRequestStatus } from '../lib/helpRequests';`
to
`import { hasUnread, isHelpRequestStatus, isImageAttachment, groupAttachmentsByMessage } from '../lib/helpRequests';`
and add `import type { HelpRequestAttachment } from '../types';` below it.

Then append before the final `console.log('help-requests OK');`:

```typescript
// isImageAttachment
assert.strictEqual(isImageAttachment('foto.PNG'), true);
assert.strictEqual(isImageAttachment('surat.pdf'), false);
assert.strictEqual(isImageAttachment('https://r2/x/a.jpg?token=1'), true);
assert.strictEqual(isImageAttachment('archive.zip'), false);

// groupAttachmentsByMessage
const att = (id: string, messageId: string | null): HelpRequestAttachment => ({
  id, requestId: 'r', messageId, name: id, url: id, source: 'upload', documentId: null, createdAt: '2026-01-01',
});
const grouped = groupAttachmentsByMessage([att('a', null), att('b', 'm1'), att('c', 'm1'), att('d', 'm2')]);
assert.strictEqual(grouped.requestLevel.length, 1);
assert.strictEqual(grouped.requestLevel[0].id, 'a');
assert.strictEqual(grouped.byMessage.get('m1')?.length, 2);
assert.strictEqual(grouped.byMessage.get('m2')?.length, 1);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx scripts/test-help-requests.ts`
Expected: FAIL — `isImageAttachment`/`groupAttachmentsByMessage` are not exported.

- [ ] **Step 3: Implement the helpers**

Add to `lib/helpRequests.ts`. First add the type import at the top:
```typescript
import type { HelpRequestStatus, HelpRequestAttachment } from '../types';
```
(replace the existing `import type { HelpRequestStatus } from '../types';` line).

Then append:
```typescript
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/;

/** True when the name/url points at a common image type (ignores query string). */
export function isImageAttachment(nameOrUrl: string): boolean {
  return IMAGE_EXT.test(nameOrUrl.split('?')[0].toLowerCase());
}

/** Splits attachments into initial-request (messageId null) and per-message groups. */
export function groupAttachmentsByMessage(attachments: HelpRequestAttachment[]): {
  requestLevel: HelpRequestAttachment[];
  byMessage: Map<string, HelpRequestAttachment[]>;
} {
  const requestLevel: HelpRequestAttachment[] = [];
  const byMessage = new Map<string, HelpRequestAttachment[]>();
  for (const a of attachments) {
    if (a.messageId === null) {
      requestLevel.push(a);
    } else {
      const arr = byMessage.get(a.messageId) ?? [];
      arr.push(a);
      byMessage.set(a.messageId, arr);
    }
  }
  return { requestLevel, byMessage };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx tsx scripts/test-help-requests.ts`
Expected: PASS — `help-requests OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/helpRequests.ts scripts/test-help-requests.ts
git commit -m "feat: add isImageAttachment and groupAttachmentsByMessage helpers"
```

---

## Task 4: Data layer

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add attachment types to the imports**

In the `import { ... } from '../types';` block near the top of `lib/supabase.ts`, add:
```
  AttachmentSource,
  HelpRequestAttachment,
```

- [ ] **Step 2: Add `uploadCoordinationFile` (after `uploadAssetFile`)**

```typescript
export async function uploadCoordinationFile(file: File): Promise<{ url: string; storageKey: string } | null> {
  try {
    validateFileSize(file, MAX_ASSET_SIZE_MB);
    const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
    const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL;
    if (!workerUrl || !publicUrlBase) {
      throw new Error('Konfigurasi R2 belum lengkap. Periksa VITE_R2_WORKER_URL dan VITE_R2_PUBLIC_URL.');
    }
    const storageKey = `coordination/${Date.now()}_${sanitizeAssetFileName(file.name)}`;
    const response = await fetch(`${workerUrl}/${storageKey}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload via worker failed: ${response.status}`);
    }
    return { url: `${publicUrlBase}/${storageKey}`, storageKey };
  } catch (error) {
    console.error('Error uploading coordination file:', error);
    throw error;
  }
}
```

- [ ] **Step 3: Change `createHelpRequest` to return the new id**

Replace the whole function with:
```typescript
export async function createHelpRequest(toUser: string, subject: string, body: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from('help_requests')
      .insert({ from_user: uid, to_user: toUser, subject, body })
      .select('id')
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (error) {
    console.error('Error creating help request:', error);
    return null;
  }
}
```

- [ ] **Step 4: Change `postHelpRequestMessage` to return the new id**

Replace the whole function with:
```typescript
export async function postHelpRequestMessage(requestId: string, body: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase
      .from('help_request_messages')
      .insert({ request_id: requestId, sender_user: uid, body })
      .select('id')
      .single();
    if (error) throw error;
    // Bump parent so it re-sorts to the top of both participants' lists.
    await supabase.from('help_requests').update({ updated_at: new Date().toISOString() }).eq('id', requestId);
    return data?.id ?? null;
  } catch (error) {
    console.error('Error posting help request message:', error);
    return null;
  }
}
```

(The existing callers in `ComposeForm`/`RequestThread` use `if (ok)` — a non-empty id string is truthy, so they keep compiling until Tasks 6–7 rewrite them.)

- [ ] **Step 5: Add attachment insert + fetch (append after `fetchRecipients`)**

```typescript
export async function addHelpRequestAttachments(
  requestId: string,
  messageId: string | null,
  items: { name: string; url: string; source: AttachmentSource; documentId?: string | null }[],
): Promise<boolean> {
  if (!supabase || items.length === 0) return true;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return false;
    const rows = items.map((it) => ({
      request_id: requestId,
      message_id: messageId,
      uploaded_by: uid,
      name: it.name,
      url: it.url,
      source: it.source,
      document_id: it.documentId ?? null,
    }));
    const { error } = await supabase.from('help_request_attachments').insert(rows);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error adding help request attachments:', error);
    return false;
  }
}

export async function fetchHelpRequestAttachments(requestId: string): Promise<HelpRequestAttachment[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('help_request_attachments')
      .select('id, request_id, message_id, name, url, source, document_id, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) throw error;
    return (data || []).map((a: any) => ({
      id: a.id,
      requestId: a.request_id,
      messageId: a.message_id ?? null,
      name: a.name,
      url: a.url,
      source: a.source,
      documentId: a.document_id ?? null,
      createdAt: a.created_at,
    }));
  } catch (error) {
    console.error('Error fetching help request attachments:', error);
    throw error;
  }
}
```

- [ ] **Step 6: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.
Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "supabase.ts"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add coordination upload, attachment data layer, return ids"
```

---

## Task 5: Shared upload resolver + pickers

**Files:**
- Create: `components/coordination/attachmentUpload.ts`
- Create: `components/coordination/DocumentPicker.tsx`
- Create: `components/coordination/AttachmentPicker.tsx`

- [ ] **Step 1: Create `attachmentUpload.ts`**

```typescript
import type { AttachmentDraft, AttachmentSource } from '../../types';
import { uploadCoordinationFile } from '../../lib/supabase';

export interface ResolvedAttachment {
  name: string;
  url: string;
  source: AttachmentSource;
  documentId?: string | null;
}

/** Uploads pending files and maps document drafts to persistable rows. Skips failed uploads. */
export async function resolveAttachments(drafts: AttachmentDraft[]): Promise<ResolvedAttachment[]> {
  const out: ResolvedAttachment[] = [];
  for (const d of drafts) {
    if (d.source === 'document' && d.url) {
      out.push({ name: d.name, url: d.url, source: 'document', documentId: d.documentId ?? null });
    } else if (d.source === 'upload' && d.file) {
      try {
        const up = await uploadCoordinationFile(d.file);
        if (up) out.push({ name: d.name, url: up.url, source: 'upload' });
      } catch {
        // skip failed upload; the rest still send
      }
    }
  }
  return out;
}
```

- [ ] **Step 2: Create `DocumentPicker.tsx`**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { DocumentItem } from '../../types';
import { fetchAllDocuments } from '../../lib/supabase';

interface PickedDoc { name: string; url: string; documentId: string; }

export const DocumentPicker: React.FC<{ onClose: () => void; onPick: (doc: PickedDoc) => void }> = ({ onClose, onPick }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchAllDocuments()
      .then((all) => setDocs(all.filter((d) => (d.link || '').trim().length > 0)))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const labelOf = (d: DocumentItem) => d.deskripsi || d.jenisDokumen || 'Dokumen';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.deskripsi, d.jenisDokumen, d.keterangan, d.pengisi].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [docs, query]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-3">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">Pilih dari Dokumen</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup"><X size={18} /></button>
        </div>
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5">
            <Search size={15} className="text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari dokumen…" aria-label="Cari dokumen" className="w-full py-2 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <p className="p-3 text-sm text-slate-500">Memuat dokumen…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Tidak ada dokumen ber-softfile.</p>
          ) : (
            filtered.map((d) => (
              <button
                key={d.id}
                onClick={() => onPick({ name: labelOf(d), url: d.link as string, documentId: d.id })}
                className="mb-1 w-full rounded-lg border border-slate-200 p-2.5 text-left transition hover:border-slate-300"
              >
                <span className="block truncate text-sm font-medium text-slate-900">{labelOf(d)}</span>
                {(d.jenisDokumen || d.tanggal) && (
                  <span className="block truncate text-xs text-slate-500">{[d.jenisDokumen, d.tanggal].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Create `AttachmentPicker.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, X } from 'lucide-react';
import type { AttachmentDraft } from '../../types';
import { isImageAttachment } from '../../lib/helpRequests';
import { DocumentPicker } from './DocumentPicker';

let draftCounter = 0;
const nextKey = () => `d${draftCounter++}`;

export const AttachmentPicker: React.FC<{ drafts: AttachmentDraft[]; onChange: (next: AttachmentDraft[]) => void }> = ({ drafts, onChange }) => {
  const [pickingDoc, setPickingDoc] = useState(false);
  const prevRef = useRef<AttachmentDraft[]>([]);

  // Revoke object URLs for drafts that disappeared (removed here, or cleared by
  // the parent after send), and everything still staged on unmount.
  useEffect(() => {
    const keys = new Set(drafts.map((d) => d.key));
    prevRef.current.forEach((d) => { if (!keys.has(d.key) && d.previewUrl) URL.revokeObjectURL(d.previewUrl); });
    prevRef.current = drafts;
  }, [drafts]);
  useEffect(() => () => { prevRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl)); }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added: AttachmentDraft[] = Array.from(files).map((file) => ({
      key: nextKey(),
      name: file.name,
      source: 'upload',
      file,
      previewUrl: isImageAttachment(file.name) ? URL.createObjectURL(file) : undefined,
    }));
    onChange([...drafts, ...added]);
  };

  // Revocation is handled by the diff effect above.
  const remove = (key: string) => onChange(drafts.filter((d) => d.key !== key));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
          <Paperclip size={14} /> Upload file
          <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => setPickingDoc(true)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300">
          <FileText size={14} /> Dari Dokumen
        </button>
      </div>

      {drafts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {drafts.map((d) => {
            const preview = d.previewUrl ?? (d.source === 'document' && isImageAttachment(d.name) ? d.url : undefined);
            return (
              <span key={d.key} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1.5 pr-1 text-xs text-slate-700">
                {preview ? (
                  <img src={preview} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <FileText size={14} className="text-slate-400" />
                )}
                <span className="max-w-[10rem] truncate">{d.name}</span>
                <button type="button" onClick={() => remove(d.key)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200" aria-label="Hapus lampiran"><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}

      {pickingDoc && (
        <DocumentPicker
          onClose={() => setPickingDoc(false)}
          onPick={(doc) => {
            onChange([...drafts, { key: nextKey(), name: doc.name, source: 'document', url: doc.url, documentId: doc.documentId }]);
            setPickingDoc(false);
          }}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 4: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.
Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "AttachmentPicker|DocumentPicker|attachmentUpload"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/coordination/attachmentUpload.ts components/coordination/DocumentPicker.tsx components/coordination/AttachmentPicker.tsx
git commit -m "feat: add AttachmentPicker, DocumentPicker, and upload resolver"
```

---

## Task 6: Attachments in ComposeForm

**Files:**
- Modify: `components/coordination/CoordinationPanel.tsx`

- [ ] **Step 1: Update imports**

Add `AttachmentDraft` to the type import from `../../types`, add `addHelpRequestAttachments` to the `../../lib/supabase` import, and add:
```tsx
import { AttachmentPicker } from './AttachmentPicker';
import { resolveAttachments } from './attachmentUpload';
```

- [ ] **Step 2: Add attachment state + submit wiring in `ComposeForm`**

Replace the `ComposeForm` component's state + `submit` (the block from `const [sending, setSending] = useState(false);` down through the end of `submit`) with:
```tsx
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);

  useEffect(() => { fetchRecipients().then(setRecipients).catch(() => setRecipients([])); }, []);

  const submit = async () => {
    if (!toUser || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    const requestId = await createHelpRequest(toUser, subject.trim(), body.trim());
    if (!requestId) { setSending(false); return; }
    const resolved = await resolveAttachments(attachments);
    if (resolved.length) await addHelpRequestAttachments(requestId, null, resolved);
    setSending(false);
    onSent();
  };
```

- [ ] **Step 3: Render the picker before the action buttons**

Immediately before the `<div className="flex justify-end gap-2">` action row in `ComposeForm`, add:
```tsx
      <AttachmentPicker drafts={attachments} onChange={setAttachments} />
```

- [ ] **Step 4: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/coordination/CoordinationPanel.tsx
git commit -m "feat: attach files when composing a Chat JS request"
```

---

## Task 7: Attachments in RequestThread (reply + render)

**Files:**
- Modify: `components/coordination/RequestThread.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Send, ExternalLink } from 'lucide-react';
import type { AttachmentDraft, HelpRequestAttachment, HelpRequestMessage, HelpRequestStatus, HelpRequestSummary } from '../../types';
import {
  addHelpRequestAttachments,
  fetchHelpRequestAttachments,
  fetchHelpRequestThread,
  postHelpRequestMessage,
  updateHelpRequestStatus,
} from '../../lib/supabase';
import { groupAttachmentsByMessage, isImageAttachment } from '../../lib/helpRequests';
import { resolveAttachments } from './attachmentUpload';
import { AttachmentPicker } from './AttachmentPicker';
import { SegmentedTabs, Button } from '../ui';

const STATUS_TABS = [
  { id: 'open', label: 'Terbuka' },
  { id: 'in_progress', label: 'Diproses' },
  { id: 'done', label: 'Selesai' },
];

const AttachmentList: React.FC<{ items: HelpRequestAttachment[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((a) =>
        isImageAttachment(a.name) || isImageAttachment(a.url) ? (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}>
            <img src={a.url} alt={a.name} loading="lazy" className="max-h-40 rounded-lg border border-slate-200 object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[12rem] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-[#0066cc] hover:border-slate-300"
          >
            <ExternalLink size={12} /> <span className="truncate">{a.name}</span>
          </a>
        ),
      )}
    </div>
  );
};

interface Props {
  request: HelpRequestSummary;
  currentUserId: string;
  onBack: () => void;
  onChanged: () => void;
}

export const RequestThread: React.FC<Props> = ({ request, currentUserId, onBack, onChanged }) => {
  const [messages, setMessages] = useState<HelpRequestMessage[]>([]);
  const [attachments, setAttachments] = useState<HelpRequestAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [status, setStatus] = useState<HelpRequestStatus>(request.status);
  const [sending, setSending] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchHelpRequestThread(request.id).catch(() => []),
      fetchHelpRequestAttachments(request.id).catch(() => []),
    ])
      .then(([msgs, atts]) => { setMessages(msgs); setAttachments(atts); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [request.id]);

  const grouped = groupAttachmentsByMessage(attachments);

  const send = async () => {
    const body = reply.trim();
    if ((!body && drafts.length === 0) || sending) return;
    setSending(true);
    const messageId = await postHelpRequestMessage(request.id, body || '(lampiran)');
    if (messageId) {
      const resolved = await resolveAttachments(drafts);
      if (resolved.length) await addHelpRequestAttachments(request.id, messageId, resolved);
      setReply('');
      setDrafts([]);
      onChanged();
      load();
    }
    setSending(false);
  };

  const changeStatus = async (next: string) => {
    const prev = status;
    setStatus(next as HelpRequestStatus);
    const ok = await updateHelpRequestStatus(request.id, next as HelpRequestStatus);
    if (ok) onChanged();
    else setStatus(prev);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{request.subject}</h3>
        <p className="text-xs text-slate-500">{request.counterpartName}</p>
        <AttachmentList items={grouped.requestLevel} />
        <div className="mt-3"><SegmentedTabs tabs={STATUS_TABS} value={status} onChange={changeStatus} /></div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <p className="text-sm text-slate-500">Memuat percakapan…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada balasan. Mulai percakapan di bawah.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderUser === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? 'bg-blue-50 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                  {m.body}
                </div>
                <AttachmentList items={grouped.byMessage.get(m.id) ?? []} />
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <AttachmentPicker drafts={drafts} onChange={setDrafts} />
        <div className="mt-2 flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Tulis balasan…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
          />
          <Button onClick={send} disabled={sending || (!reply.trim() && drafts.length === 0)}><Send size={16} /></Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.
Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "RequestThread"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/coordination/RequestThread.tsx
git commit -m "feat: attach files in replies and render attachments with image previews"
```

---

## Task 8: Final verification

- [ ] **Step 1: Logic tests**

Run: `npx tsx scripts/test-help-requests.ts`
Expected: `help-requests OK`.

- [ ] **Step 2: Build + typecheck of touched files**

Run: `./node_modules/.bin/vite build`
Expected: exit 0.
Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "helpRequests|Attachment|DocumentPicker|RequestThread|CoordinationPanel|supabase.ts"`
Expected: no output.

- [ ] **Step 3: Confirm migration is not applied automatically**

The migration file exists but must be applied by the user to project `qafozqmwlfenxorshgfl`. Note this in the final report.

- [ ] **Step 4: Manual smoke test (after migration applied)**

Compose a request with one uploaded image + one Dokumen file → send. As the recipient, open the thread: the image shows as a thumbnail, the document as a link. Reply with an attached file; confirm it renders under the reply for both participants.
```
