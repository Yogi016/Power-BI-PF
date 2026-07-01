# User Role Profile Setup

Tanggal: 2026-07-02

## Prinsip

Akun user dibuat hanya lewat Supabase Auth. Role aplikasi disimpan di tabel public agar bisa dipilih dan diaudit tanpa mengandalkan `user_metadata`.

## Tabel

### `public.app_roles`

Tabel master role untuk dropdown:

- `vp_lingkungan`
- `project_manager`
- `project_head`
- `staff_officer`

### `public.user_profiles`

Tabel profil operasional user:

- `user_id`: UUID dari `auth.users.id`
- `full_name`: nama tampil di aplikasi
- `role_code`: foreign key ke `public.app_roles.code`
- `assigned_project_ids`: daftar project yang ditugaskan
- `is_active`: status user aktif

## Cara Membuat User

1. Buat user di Supabase Dashboard -> Authentication -> Users.
2. Trigger database otomatis membuat row di `public.user_profiles`.
3. Buka Table Editor -> `public.user_profiles`.
4. Cari user yang baru dibuat.
5. Ubah `full_name` jika perlu.
6. Pilih `role_code` dari dropdown role.
7. Kosongkan `assigned_project_ids` dulu jika belum dipakai.
8. Pastikan `is_active` bernilai true.
9. User login dari aplikasi seperti biasa.

Default role otomatis adalah `staff_officer`. Jika row `user_profiles` belum dibuat karena migration belum aktif, aplikasi tetap fallback ke metadata Auth atau default `staff_officer`.
