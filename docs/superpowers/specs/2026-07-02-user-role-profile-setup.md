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
2. Salin UUID user dari tabel Auth user.
3. Buka Table Editor -> `public.user_profiles`.
4. Tambahkan row:
   - `user_id`: UUID user Auth
   - `full_name`: nama user
   - `role_code`: pilih dari dropdown role
   - `assigned_project_ids`: kosongkan dulu jika belum dipakai
   - `is_active`: true
5. User login dari aplikasi seperti biasa.

Jika row `user_profiles` belum dibuat, aplikasi fallback ke metadata Auth atau default `staff_officer`.
