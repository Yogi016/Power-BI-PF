# Desain: Penegakan Role Transisi PKS/MOU (#1) + Scoping Proyek per Role (#4)

Tanggal: 2026-07-02
Status: Disetujui (rancangan), siap untuk implementation plan.

## Latar Belakang

Sistem multi-level saat ini punya 4 role (`staff_officer` < `project_head` < `project_manager` < `vp_lingkungan`) yang terdefinisi rapi di `lib/roleUtils.ts` dan tabel `app_roles`/`user_profiles`, plus routing inbox per role di `lib/cooperationWorkflow.ts`. Namun level tersebut belum ditegakkan:

- **#1** RLS tabel cooperation memakai `FOR ALL TO authenticated USING(true) WITH CHECK(true)` — siapa pun yang login bisa mengubah status dokumen ke status apa pun. Selain itu, jalur transisi status antar tahap approval **belum ada** sebagai fungsi mutasi (hanya `createCooperationDocumentDraft` dan upload versi yang ada).
- **#4** Kolom `user_profiles.assigned_project_ids` (UUID[]) sudah dibaca ke `AuthContext` tapi tidak dipakai untuk membatasi proyek yang dilihat. Semua role melihat semua proyek.

Gap #2 (nav gating) dan #3 (level admin & manajemen user in-app) **sengaja diabaikan** atas permintaan user; tidak masuk scope dokumen ini.

## Tujuan

1. **#1** — Transisi status PKS/MOU hanya boleh dilakukan oleh role yang berhak, ditegakkan di sisi server (Postgres), tidak bisa ditembus lewat query langsung dari browser.
2. **#4** — `staff_officer` dan `project_head` hanya melihat proyek yang tercantum di `assigned_project_ids` mereka; `project_manager` dan `vp_lingkungan` tetap melihat semua proyek. Penegakan cukup di lapisan UI.

## Non-Tujuan

- Tidak menambah nav gating per role (#2).
- Tidak menambah halaman admin / manajemen user in-app (#3).
- Tidak mengubah RLS tabel `projects` (scoping #4 murni UI-level, keputusan user).
- Tidak mengubah alur pembuatan draft (`createCooperationDocumentDraft`) maupun upload versi.

---

## Bagian #1 — Penegakan Role Transisi Status (RPC + Trigger)

Diimplementasikan sebagai **satu migration baru** (urutan setelah `20260702020000_...`), berisi tiga lapis:

### a. Helper role: `public.current_app_role()`

```sql
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
```

- STABLE + SECURITY DEFINER agar bisa membaca `user_profiles` tanpa terhalang RLS "read own profile".
- Default `staff_officer` bila profil tidak ada / non-aktif (fail ke level terendah).

### b. Matriks transisi + trigger penjaga (hard guard)

Fungsi boolean berisi matriks yang disepakati:

```sql
CREATE OR REPLACE FUNCTION public.is_valid_cooperation_transition(
    p_from TEXT, p_to TEXT, p_role TEXT
) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
    SELECT (p_from, p_to, p_role) IN (
        -- Staff Officer
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
        -- Project Head
        ('review-project-head',       'review-legal-internal',     'project_head'),
        ('review-project-head',       'revisi-final',              'project_head'),
        -- Project Manager
        ('validasi-project-manager',  'menunggu-approval-vp',      'project_manager'),
        ('validasi-project-manager',  'revisi-final',              'project_manager'),
        ('monitoring-implementasi',   'selesai',                   'project_manager'),
        ('monitoring-implementasi',   'diperpanjang',              'project_manager'),
        ('monitoring-implementasi',   'diarsipkan',                'project_manager'),
        -- VP Lingkungan
        ('menunggu-approval-vp',      'disetujui-vp',              'vp_lingkungan'),
        ('menunggu-approval-vp',      'revisi-final',              'vp_lingkungan')
    );
$$;
```

Trigger `BEFORE UPDATE` di `cooperation_documents` — hanya cek saat `status` berubah:

```sql
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

CREATE TRIGGER trg_enforce_cooperation_transition
    BEFORE UPDATE ON cooperation_documents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_cooperation_transition();
```

Trigger tetap menyala walau update datang dari RPC SECURITY DEFINER (auth.uid() tetap berasal dari JWT), sehingga jadi penjaga terakhir yang tak bisa ditembus baik lewat `.update()` langsung maupun RPC.

### c. RPC entry point: `public.advance_cooperation_status(...)`

```sql
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

    -- UPDATE memicu trigger penjaga; bila tak valid akan RAISE dan seluruh transaksi batal.
    UPDATE cooperation_documents
       SET status = p_to_status, updated_at = NOW()
     WHERE id = p_document_id;

    v_action := CASE
        WHEN p_to_status = 'revisi-final' AND v_from IN
            ('review-project-head','validasi-project-manager','menunggu-approval-vp')
            THEN 'requested_revision'
        WHEN p_to_status = 'disetujui-vp' THEN 'approved'
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

Catatan skema (diverifikasi terhadap `20260702010000_...`): kolom komentar di `cooperation_document_approvals` bernama `comment` (bukan `notes`); `audit_events` memakai `from_value`/`to_value` JSONB + `actor_role`.

### d. Sisi aplikasi

- `lib/supabase.ts`: fungsi baru
  ```ts
  export async function advanceCooperationStatus(
    documentId: string, toStatus: CooperationDocumentStatus, notes?: string
  ): Promise<CooperationDocumentStatus | null>
  ```
  memanggil `supabase.rpc('advance_cooperation_status', { p_document_id, p_to_status, p_notes })`, mengembalikan status baru atau `null` bila error (log pesan RAISE untuk UX).
- `lib/cooperationWorkflow.ts`: mirror matriks di client
  ```ts
  export function getAllowedTransitions(
    status: CooperationDocumentStatus, role: UserRole
  ): { to: CooperationDocumentStatus; label: string; kind: 'advance' | 'revisi' }[]
  ```
  Server tetap sumber kebenaran; fungsi ini hanya untuk menampilkan/menyembunyikan tombol aksi.
- `pages/CooperationDocumentsPage.tsx`: pada detail dokumen, render tombol aksi dari `getAllowedTransitions(doc.status, role)`. Klik → `advanceCooperationStatus(...)` → refresh dokumen. Bila RPC gagal (mis. race role), tampilkan pesan error.

---

## Bagian #4 — Scoping Proyek per Role (UI-level)

Satu titik filter terpusat di `context/DataContext.tsx`.

- `DataProvider` dirender di dalam area terautentikasi (`App.tsx:38`), di bawah `AuthProvider` (`App.tsx:102`), sehingga boleh memanggil `useAuth()`.
- Ambil `role` dan `profile?.assignedProjectIds` dari `useAuth()`.
- Definisikan `SCOPED_ROLES = new Set(['staff_officer', 'project_head'])`.
- Setelah `projects` dimuat (baik jalur Supabase maupun CSV), turunkan `visibleProjects`:
  ```ts
  const shouldScope =
    SCOPED_ROLES.has(role) && (assignedProjectIds?.length ?? 0) > 0 && supabaseLoaded;
  const visibleProjects = shouldScope
    ? projects.filter(p => assignedProjectIds.includes(p.id))
    : projects;
  ```
- Nilai `projects` yang diekspos context diganti dengan `visibleProjects` agar semua halaman (Dashboard, Manage Data, Work, Gantt, Calendar) otomatis ter-scope tanpa perubahan per halaman.

### Keputusan default (disetujui user)

1. **Scoped role dengan `assignedProjectIds` kosong → fail-open (lihat semua).** Mencegah dashboard blank sebelum admin mengisi assignment. Dapat dibalik ke fail-closed nanti dengan mengganti syarat `shouldScope`.
2. **Fallback CSV → scoping dilewati (lihat semua).** Id proyek CSV bukan UUID sehingga tak akan match `assigned_project_ids` dan filter akan mengosongkan seluruh dashboard. Aturan eksplisit: **scoping hanya diterapkan saat sumber proyek berasal dari Supabase.** DataContext punya flag `supabaseLoaded` yang menjadi `true` setelah jalur Supabase memanggil `setProjects(mappedProjects)` (id UUID). Syarat final: `shouldScope = SCOPED_ROLES.has(role) && assignedProjectIds.length > 0 && supabaseLoaded`. (Catatan: `csvLoaded` tetap `true` walau Supabase kemudian menimpa data, jadi `supabaseLoaded` adalah sinyal yang benar, bukan `!csvLoaded`.)

### Catatan keterbatasan

- Scoping bermakna hanya untuk proyek yang di-backing Supabase (id UUID). Ringkasan mingguan / baseline agregat yang dihitung global mungkin masih mencerminkan seluruh proyek; scope diterapkan pada array `projects` dan activity turunannya. Perluasan ke agregat mingguan di luar scope dokumen ini.
- Karena penegakan hanya UI-level, data proyek tetap dapat diakses lewat query Supabase langsung. Ini keputusan sadar user (bukan celah tak sengaja).

---

## Berkas yang Disentuh

**Baru**
- `supabase/migrations/2026070300XXXX_cooperation_role_enforcement.sql` — helper role, matriks, trigger, RPC.

**Diubah**
- `lib/supabase.ts` — `advanceCooperationStatus()`.
- `lib/cooperationWorkflow.ts` — `getAllowedTransitions()` (mirror matriks client).
- `pages/CooperationDocumentsPage.tsx` — tombol aksi transisi ber-gate role.
- `context/DataContext.tsx` — scoping proyek UI-level via `useAuth()`.

## Verifikasi

- `npx tsx scripts/test-cooperation-workflow.ts` untuk logika workflow (tambah kasus uji matriks transisi bila skrip mendukung).
- `./node_modules/.bin/vite build` untuk memastikan build lolos.
- Migration diterapkan hanya ke project Supabase yang ref-nya sudah dikonfirmasi (lihat AGENTS.md — jangan lewat MCP tanpa konfirmasi ref).
- Uji manual per role: login tiap role, pastikan tombol transisi yang muncul sesuai matriks, dan transisi terlarang ditolak server (RPC melempar error).
