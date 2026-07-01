# Penegakan Role Transisi PKS/MOU + Scoping Proyek — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menegakkan transisi status PKS/MOU per role di sisi Postgres (#1) dan membatasi proyek yang dilihat `staff_officer`/`project_head` ke `assigned_project_ids` di lapisan UI (#4).

**Architecture:** #1 memakai matriks transisi tunggal yang dicerminkan di dua tempat — fungsi murni TypeScript `getAllowedTransitions()` untuk UI, dan trigger `BEFORE UPDATE` + RPC `advance_cooperation_status` SECURITY DEFINER di Postgres sebagai penjaga yang tak bisa ditembus. #4 memakai satu fungsi murni `scopeProjectsForRole()` yang dipanggil `DataContext` sehingga semua halaman ikut ter-scope.

**Tech Stack:** Vite + React (TypeScript), Supabase Postgres (RPC/trigger PL/pgSQL), `npx tsx` untuk unit test skrip, `node:assert/strict`.

## Global Constraints

- Copy produk berbahasa Indonesia (AGENTS.md).
- Verifikasi build pakai `./node_modules/.bin/vite build`, JANGAN `npm run build` (memicu update R2 CORS).
- Migration hanya diterapkan ke project Supabase yang ref-nya dikonfirmasi; jangan lewat MCP tanpa konfirmasi ref (AGENTS.md).
- Nama kolom terverifikasi: `cooperation_document_approvals` memakai `comment` (bukan `notes`); `audit_events` memakai `from_value`/`to_value` JSONB + `actor_role`.
- Status valid didefinisikan di `types.ts` `CooperationDocumentStatus` dan CHECK di migration `20260702010000_create_cooperation_documents.sql`.
- Scoping #4 hanya UI-level (keputusan user); tidak mengubah RLS tabel `projects`.

---

## File Structure

**Baru**
- `supabase/migrations/20260703000000_cooperation_role_enforcement.sql` — helper role, matriks, trigger, RPC.
- `utils/projectScope.ts` — fungsi murni `scopeProjectsForRole()`.
- `scripts/test-project-scope.ts` — unit test scoping.

**Diubah**
- `lib/cooperationWorkflow.ts` — `COOPERATION_TRANSITIONS` + `getAllowedTransitions()`.
- `scripts/test-cooperation-workflow.ts` — tambah assertion untuk `getAllowedTransitions()`.
- `lib/supabase.ts` — `advanceCooperationStatus()`.
- `pages/CooperationDocumentsPage.tsx` — kolom "Aksi" + tombol transisi ber-gate role.
- `context/DataContext.tsx` — panggil `scopeProjectsForRole()` dan ekspos `projects` yang sudah ter-scope.

---

## Task 1: Matriks transisi client + `getAllowedTransitions()`

**Files:**
- Modify: `lib/cooperationWorkflow.ts` (tambah di dekat blok status labels)
- Test: `scripts/test-cooperation-workflow.ts`

**Interfaces:**
- Consumes: `CooperationDocumentStatus`, `UserRole` (dari `types.ts`); `getCooperationStatusLabel()` (sudah ada di file ini).
- Produces:
  - `COOPERATION_TRANSITIONS: CooperationTransition[]`
  - `getAllowedTransitions(status: CooperationDocumentStatus, role: UserRole): { to: CooperationDocumentStatus; label: string; kind: 'advance' | 'revisi' }[]`

- [ ] **Step 1: Tulis test yang gagal**

Tambah di akhir `scripts/test-cooperation-workflow.ts` (sebelum baris `console.log('cooperation workflow checks passed');`), dan tambahkan `getAllowedTransitions` ke daftar import dari `../lib/cooperationWorkflow`:

```ts
// --- getAllowedTransitions ---
const vpActions = getAllowedTransitions('menunggu-approval-vp', 'vp_lingkungan');
assert.deepEqual(
  vpActions.map((a) => a.to).sort(),
  ['disetujui-vp', 'revisi-final'],
  'VP di status menunggu-approval-vp boleh menyetujui atau mengembalikan ke revisi'
);
assert.equal(
  vpActions.find((a) => a.to === 'revisi-final')?.kind,
  'revisi',
  'aksi ke revisi-final harus berjenis revisi'
);

assert.deepEqual(
  getAllowedTransitions('menunggu-approval-vp', 'staff_officer'),
  [],
  'staff officer tidak boleh transisi di status menunggu-approval-vp'
);

assert.deepEqual(
  getAllowedTransitions('review-project-head', 'project_head').map((a) => a.to).sort(),
  ['review-legal-internal', 'revisi-final'],
  'project head boleh lanjut ke review-legal-internal atau kembalikan ke revisi'
);

assert.deepEqual(
  getAllowedTransitions('draft-internal', 'staff_officer').map((a) => a.to),
  ['review-project-head'],
  'staff officer mengirim draft ke review project head'
);
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx tsx scripts/test-cooperation-workflow.ts`
Expected: FAIL — `getAllowedTransitions is not a function` / import error.

- [ ] **Step 3: Implementasi minimal**

Tambah di `lib/cooperationWorkflow.ts` setelah konstanta `COOPERATION_STATUSES`:

```ts
export type CooperationTransition = {
  from: CooperationDocumentStatus;
  to: CooperationDocumentStatus;
  role: UserRole;
  kind: 'advance' | 'revisi';
};

export const COOPERATION_TRANSITIONS: CooperationTransition[] = [
  // Staff Officer
  { from: 'draft-internal', to: 'review-project-head', role: 'staff_officer', kind: 'advance' },
  { from: 'review-legal-internal', to: 'review-mitra', role: 'staff_officer', kind: 'advance' },
  { from: 'review-mitra', to: 'revisi-final', role: 'staff_officer', kind: 'advance' },
  { from: 'revisi-final', to: 'validasi-project-manager', role: 'staff_officer', kind: 'advance' },
  { from: 'disetujui-vp', to: 'siap-ttd', role: 'staff_officer', kind: 'advance' },
  { from: 'siap-ttd', to: 'proses-ttd', role: 'staff_officer', kind: 'advance' },
  { from: 'proses-ttd', to: 'aktif', role: 'staff_officer', kind: 'advance' },
  { from: 'aktif', to: 'monitoring-implementasi', role: 'staff_officer', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'selesai', role: 'staff_officer', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diperpanjang', role: 'staff_officer', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diarsipkan', role: 'staff_officer', kind: 'advance' },
  // Project Head
  { from: 'review-project-head', to: 'review-legal-internal', role: 'project_head', kind: 'advance' },
  { from: 'review-project-head', to: 'revisi-final', role: 'project_head', kind: 'revisi' },
  // Project Manager
  { from: 'validasi-project-manager', to: 'menunggu-approval-vp', role: 'project_manager', kind: 'advance' },
  { from: 'validasi-project-manager', to: 'revisi-final', role: 'project_manager', kind: 'revisi' },
  { from: 'monitoring-implementasi', to: 'selesai', role: 'project_manager', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diperpanjang', role: 'project_manager', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diarsipkan', role: 'project_manager', kind: 'advance' },
  // VP Lingkungan
  { from: 'menunggu-approval-vp', to: 'disetujui-vp', role: 'vp_lingkungan', kind: 'advance' },
  { from: 'menunggu-approval-vp', to: 'revisi-final', role: 'vp_lingkungan', kind: 'revisi' },
];

export function getAllowedTransitions(
  status: CooperationDocumentStatus,
  role: UserRole
): { to: CooperationDocumentStatus; label: string; kind: 'advance' | 'revisi' }[] {
  return COOPERATION_TRANSITIONS
    .filter((t) => t.from === status && t.role === role)
    .map((t) => ({
      to: t.to,
      label: t.kind === 'revisi' ? 'Kembalikan ke Revisi' : getCooperationStatusLabel(t.to),
      kind: t.kind,
    }));
}
```

Pastikan `UserRole` sudah ada di import type di bagian atas file (`import type { ..., UserRole } from '../types';` — sudah ada karena `getRoleDashboardConfig` memakainya).

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx tsx scripts/test-cooperation-workflow.ts`
Expected: PASS — `cooperation workflow checks passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/cooperationWorkflow.ts scripts/test-cooperation-workflow.ts
git commit -m "feat: add cooperation transition matrix and allowed-transition helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Migration penegakan role (helper + matriks + trigger + RPC)

**Files:**
- Create: `supabase/migrations/20260703000000_cooperation_role_enforcement.sql`

**Interfaces:**
- Consumes: tabel `cooperation_documents`, `cooperation_document_approvals`, `audit_events`, `user_profiles` (dari migration sebelumnya); `auth.uid()`.
- Produces (dipakai Task 3): RPC `public.advance_cooperation_status(p_document_id UUID, p_to_status TEXT, p_notes TEXT) RETURNS TEXT`.

> **Catatan verifikasi:** logika SQL tidak di-TDD (butuh instance DB). Verifikasi = review + apply ke Supabase yang ref-nya dikonfirmasi + uji manual (Task 4 Step 6). Matriks di `is_valid_cooperation_transition` HARUS identik dengan `COOPERATION_TRANSITIONS` Task 1.

- [ ] **Step 1: Tulis file migration**

Buat `supabase/migrations/20260703000000_cooperation_role_enforcement.sql` dengan isi:

```sql
-- Penegakan role untuk transisi status PKS/MOU (#1)

-- a. Role pemanggil saat ini
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role_code FROM public.user_profiles
         WHERE user_id = auth.uid() AND is_active = true
         LIMIT 1),
        'staff_officer'
    );
$$;

-- b. Matriks transisi (identik dengan COOPERATION_TRANSITIONS di lib/cooperationWorkflow.ts)
CREATE OR REPLACE FUNCTION public.is_valid_cooperation_transition(
    p_from TEXT, p_to TEXT, p_role TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (p_from, p_to, p_role) IN (
        ('draft-internal',            'review-project-head',       'staff_officer'),
        ('review-legal-internal',     'review-mitra',              'staff_officer'),
        ('review-mitra',              'revisi-final',              'staff_officer'),
        ('revisi-final',              'validasi-project-manager',  'staff_officer'),
        ('disetujui-vp',              'siap-ttd',                  'staff_officer'),
        ('siap-ttd',                  'proses-ttd',                'staff_officer'),
        ('proses-ttd',                'aktif',                     'staff_officer'),
        ('aktif',                     'monitoring-implementasi',   'staff_officer'),
        ('monitoring-implementasi',   'selesai',                   'staff_officer'),
        ('monitoring-implementasi',   'diperpanjang',              'staff_officer'),
        ('monitoring-implementasi',   'diarsipkan',                'staff_officer'),
        ('review-project-head',       'review-legal-internal',     'project_head'),
        ('review-project-head',       'revisi-final',              'project_head'),
        ('validasi-project-manager',  'menunggu-approval-vp',      'project_manager'),
        ('validasi-project-manager',  'revisi-final',              'project_manager'),
        ('monitoring-implementasi',   'selesai',                   'project_manager'),
        ('monitoring-implementasi',   'diperpanjang',              'project_manager'),
        ('monitoring-implementasi',   'diarsipkan',                'project_manager'),
        ('menunggu-approval-vp',      'disetujui-vp',              'vp_lingkungan'),
        ('menunggu-approval-vp',      'revisi-final',              'vp_lingkungan')
    );
$$;

-- c. Trigger penjaga: blokir perubahan status yang tak sesuai matriks
CREATE OR REPLACE FUNCTION public.enforce_cooperation_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT public.is_valid_cooperation_transition(OLD.status, NEW.status, public.current_app_role()) THEN
            RAISE EXCEPTION 'Role % tidak berhak mengubah status dari % ke %',
                public.current_app_role(), OLD.status, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cooperation_transition ON cooperation_documents;
CREATE TRIGGER trg_enforce_cooperation_transition
    BEFORE UPDATE ON cooperation_documents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_cooperation_transition();

-- d. RPC entry point: transisi + tulis approval + audit dalam 1 transaksi
CREATE OR REPLACE FUNCTION public.advance_cooperation_status(
    p_document_id UUID,
    p_to_status TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from TEXT;
    v_role TEXT := public.current_app_role();
    v_action TEXT;
BEGIN
    SELECT status INTO v_from FROM cooperation_documents WHERE id = p_document_id FOR UPDATE;
    IF v_from IS NULL THEN
        RAISE EXCEPTION 'Dokumen tidak ditemukan';
    END IF;

    -- UPDATE memicu trigger penjaga; transisi tak valid membatalkan seluruh transaksi.
    UPDATE cooperation_documents
       SET status = p_to_status, updated_at = NOW()
     WHERE id = p_document_id;

    v_action := CASE
        WHEN p_to_status = 'revisi-final'
             AND v_from IN ('review-project-head','validasi-project-manager','menunggu-approval-vp')
            THEN 'requested_revision'
        ELSE 'approved'
    END;

    INSERT INTO cooperation_document_approvals
        (document_id, approver_role, approver_user_id, action, comment, from_status, to_status)
        VALUES (p_document_id, v_role, auth.uid(), v_action, p_notes, v_from, p_to_status);

    INSERT INTO audit_events
        (entity_type, entity_id, actor_user_id, actor_role, action, from_value, to_value, notes)
        VALUES ('cooperation_document', p_document_id, auth.uid(), v_role,
                'status_transition', to_jsonb(v_from), to_jsonb(p_to_status), p_notes);

    RETURN p_to_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_cooperation_status(UUID, TEXT, TEXT) TO authenticated;
```

- [ ] **Step 2: Self-check konsistensi matriks**

Bandingkan daftar tuple di `is_valid_cooperation_transition` dengan `COOPERATION_TRANSITIONS` (Task 1) baris demi baris. Jumlah entri harus 20 dan tiap `(from, to, role)` cocok. Perbaiki bila ada selisih.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260703000000_cooperation_role_enforcement.sql
git commit -m "feat: enforce cooperation status transitions by role via trigger and rpc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Penerapan migration ke Supabase (apply) dilakukan pada tahap deploy setelah ref project dikonfirmasi — bukan bagian dari commit ini.

---

## Task 3: `advanceCooperationStatus()` di lib/supabase.ts

**Files:**
- Modify: `lib/supabase.ts` (tambah fungsi baru; letakkan setelah `fetchCooperationDocuments`, sekitar baris 2081)

**Interfaces:**
- Consumes: RPC `advance_cooperation_status` (Task 2); `supabase` client; `CooperationDocumentStatus` (sudah di-import di file ini).
- Produces (dipakai Task 4): `advanceCooperationStatus(documentId: string, toStatus: CooperationDocumentStatus, notes?: string): Promise<CooperationDocumentStatus | null>`

- [ ] **Step 1: Implementasi fungsi**

Tambah di `lib/supabase.ts`:

```ts
export async function advanceCooperationStatus(
  documentId: string,
  toStatus: CooperationDocumentStatus,
  notes?: string
): Promise<CooperationDocumentStatus | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('advance_cooperation_status', {
      p_document_id: documentId,
      p_to_status: toStatus,
      p_notes: notes ?? null,
    });

    if (error) throw error;
    return (data as CooperationDocumentStatus) ?? toStatus;
  } catch (error) {
    console.error('Error advancing cooperation status:', error);
    return null;
  }
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `./node_modules/.bin/vite build`
Expected: exit code 0 (warning chunk-size/dll boleh diabaikan).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add advanceCooperationStatus rpc wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Tombol aksi transisi ber-gate role di halaman PKS/MOU

**Files:**
- Modify: `pages/CooperationDocumentsPage.tsx`

**Interfaces:**
- Consumes: `getAllowedTransitions()` (Task 1), `advanceCooperationStatus()` (Task 3), `role` dari `useAuth()` (sudah ada di baris 72), `reloadCooperationDocuments()` (sudah ada di baris 180).
- Produces: perubahan UI saja.

- [ ] **Step 1: Tambah import**

Ubah import di baris 18 menjadi menyertakan `advanceCooperationStatus`:

```ts
import { advanceCooperationStatus, createCooperationDocumentDraft, fetchCooperationDocuments, fetchProjects, uploadCooperationDocumentFile } from '../lib/supabase';
```

Ubah import dari `../lib/cooperationWorkflow` (baris 19-26) untuk menambah `getAllowedTransitions`:

```ts
import {
  buildCooperationTasks,
  buildRoleDocumentInbox,
  distributeCooperationDocumentWeights,
  getAllowedTransitions,
  getCooperationStatusLabel,
  getRoleDashboardConfig,
  hasSignedDocument,
} from '../lib/cooperationWorkflow';
```

- [ ] **Step 2: Tambah state + handler**

Setelah baris 80 (`const [notice, setNotice] = useState<Notice>(null);`), tambah:

```ts
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const handleAdvanceStatus = async (documentId: string, toStatus: CooperationDocument['status']) => {
    setAdvancingId(documentId);
    setNotice(null);
    const result = await advanceCooperationStatus(documentId, toStatus);
    if (result) {
      await reloadCooperationDocuments();
      setNotice({ type: 'success', message: `Status dokumen diperbarui menjadi ${getCooperationStatusLabel(toStatus)}.` });
    } else {
      setNotice({ type: 'error', message: 'Transisi status gagal. Role Anda mungkin tidak berhak atau terjadi kesalahan.' });
    }
    setAdvancingId(null);
  };
```

> Terverifikasi: `type Notice = { type: 'success' | 'error'; message: string } | null` (baris 43), jadi pemakaian `setNotice` di atas sudah sesuai.

- [ ] **Step 3: Tambah kolom header "Aksi"**

Di `<thead>` (setelah baris 596 `<th className="px-3 py-2">Masa Berlaku</th>`), tambah:

```tsx
                      <th className="px-3 py-2">Aksi</th>
```

- [ ] **Step 4: Tambah sel aksi di baris**

Di dalam `.map(doc => ...)`, tepat sebelum penutup `</tr>` baris dokumen (setelah `<td>` "Masa Berlaku", sekitar baris 653), tambah:

```tsx
                          <td className="px-3 py-3 align-top">
                            {(() => {
                              const actions = getAllowedTransitions(doc.status, role);
                              if (actions.length === 0) {
                                return <span className="text-xs text-slate-400">—</span>;
                              }
                              return (
                                <div className="flex flex-col gap-1.5">
                                  {actions.map(action => (
                                    <button
                                      key={action.to}
                                      type="button"
                                      onClick={() => handleAdvanceStatus(doc.id, action.to)}
                                      disabled={advancingId === doc.id}
                                      className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                                        action.kind === 'revisi'
                                          ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                      }`}
                                    >
                                      {advancingId === doc.id ? 'Memproses...' : action.label}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
```

- [ ] **Step 5: Verifikasi build**

Run: `./node_modules/.bin/vite build`
Expected: exit code 0.

- [ ] **Step 6: Uji manual (setelah migration di-apply)**

Setelah migration Task 2 diterapkan ke Supabase yang benar:
1. Login sebagai `staff_officer`: dokumen berstatus `draft-internal` menampilkan tombol "Review Project Head"; dokumen `menunggu-approval-vp` menampilkan `—`.
2. Login sebagai `vp_lingkungan`: dokumen `menunggu-approval-vp` menampilkan "Disetujui VP" dan "Kembalikan ke Revisi".
3. Klik aksi valid → status berubah, muncul notice sukses, baris approval & audit bertambah.
4. (Negatif) Paksa transisi terlarang lewat konsol (`supabase.rpc('advance_cooperation_status', ...)`) sebagai role tak berhak → RPC mengembalikan error, status tidak berubah.

- [ ] **Step 7: Commit**

```bash
git add pages/CooperationDocumentsPage.tsx
git commit -m "feat: add role-gated status transition actions to pks/mou page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Scoping proyek per role (UI-level)

**Files:**
- Create: `utils/projectScope.ts`
- Create: `scripts/test-project-scope.ts`
- Modify: `context/DataContext.tsx`

**Interfaces:**
- Consumes: `ProjectData`, `UserRole` (dari `types.ts`); `useAuth()` (dari `context/AuthContext`); state `supabaseLoaded` (sudah ada di DataContext).
- Produces: `scopeProjectsForRole(projects: ProjectData[], role: UserRole, assignedProjectIds: string[], supabaseLoaded: boolean): ProjectData[]`

- [ ] **Step 1: Tulis test yang gagal**

Buat `scripts/test-project-scope.ts`:

```ts
import assert from 'node:assert/strict';
import { scopeProjectsForRole } from '../utils/projectScope';
import type { ProjectData } from '../types';

const p = (id: string): ProjectData => ({
  id,
  name: id,
  pic: 'x',
  activities: [],
  weeklyBaseline: [],
  weeklyActual: [],
});

const projects = [p('a'), p('b'), p('c')];

assert.deepEqual(
  scopeProjectsForRole(projects, 'staff_officer', ['a'], true).map((x) => x.id),
  ['a'],
  'staff officer hanya melihat proyek yang ditugaskan saat data Supabase'
);

assert.deepEqual(
  scopeProjectsForRole(projects, 'project_manager', ['a'], true).map((x) => x.id),
  ['a', 'b', 'c'],
  'project manager melihat semua proyek (tidak di-scope)'
);

assert.deepEqual(
  scopeProjectsForRole(projects, 'staff_officer', [], true).map((x) => x.id),
  ['a', 'b', 'c'],
  'assignment kosong = fail-open (lihat semua)'
);

assert.deepEqual(
  scopeProjectsForRole(projects, 'staff_officer', ['a'], false).map((x) => x.id),
  ['a', 'b', 'c'],
  'mode CSV (supabaseLoaded false) tidak di-scope'
);

console.log('project scope checks passed');
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx tsx scripts/test-project-scope.ts`
Expected: FAIL — modul `../utils/projectScope` tidak ditemukan.

- [ ] **Step 3: Implementasi minimal**

Buat `utils/projectScope.ts`:

```ts
import type { ProjectData, UserRole } from '../types';

const SCOPED_ROLES: UserRole[] = ['staff_officer', 'project_head'];

export function scopeProjectsForRole(
  projects: ProjectData[],
  role: UserRole,
  assignedProjectIds: string[],
  supabaseLoaded: boolean
): ProjectData[] {
  const shouldScope =
    SCOPED_ROLES.includes(role) && assignedProjectIds.length > 0 && supabaseLoaded;
  if (!shouldScope) return projects;
  return projects.filter((project) => assignedProjectIds.includes(project.id));
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx tsx scripts/test-project-scope.ts`
Expected: PASS — `project scope checks passed`.

- [ ] **Step 5: Sambungkan ke DataContext**

Di `context/DataContext.tsx`:

Tambah import (dekat baris 5):

```ts
import { useAuth } from './AuthContext';
import { scopeProjectsForRole } from '../utils/projectScope';
```

Di dalam `DataProvider`, setelah deklarasi state (setelah baris `const [supabaseLoaded, setSupabaseLoaded] = useState(false);`), tambah:

```ts
  const { role, profile } = useAuth();
```

Ganti nilai `projects` yang diekspos di provider. Sebelum `return (` (sekitar baris 232), tambah:

```ts
  const visibleProjects = scopeProjectsForRole(
    projects,
    role,
    profile?.assignedProjectIds ?? [],
    supabaseLoaded
  );
```

Lalu di objek `value={{ ... }}` ubah baris `projects,` menjadi:

```ts
      projects: visibleProjects,
```

- [ ] **Step 6: Verifikasi build**

Run: `./node_modules/.bin/vite build`
Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add utils/projectScope.ts scripts/test-project-scope.ts context/DataContext.tsx
git commit -m "feat: scope visible projects to assigned ids for staff and project head

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verifikasi Akhir

- [ ] `npx tsx scripts/test-cooperation-workflow.ts` → PASS
- [ ] `npx tsx scripts/test-project-scope.ts` → PASS
- [ ] `./node_modules/.bin/vite build` → exit 0
- [ ] Migration `20260703000000_cooperation_role_enforcement.sql` diterapkan ke Supabase yang ref-nya dikonfirmasi, lalu uji manual per role (Task 4 Step 6).
- [ ] Uji manual #4: login `staff_officer`/`project_head` dengan `assigned_project_ids` terisi → Dashboard/Manage Data/Work/Gantt hanya menampilkan proyek yang ditugaskan; login `project_manager`/`vp_lingkungan` → semua proyek.
