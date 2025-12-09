# Supabase Setup Guide

## Cara Setup Database

### 1. Buat Project Supabase
1. Buka [https://supabase.com](https://supabase.com)
2. Sign up atau login
3. Klik "New Project"
4. Isi detail project:
   - Name: `project-monitoring` (atau nama lain)
   - Database Password: Buat password yang kuat
   - Region: Pilih yang terdekat (Singapore untuk Indonesia)
5. Tunggu project selesai dibuat (~2 menit)

### 2. Jalankan Schema SQL
1. Di dashboard Supabase, klik **SQL Editor** di sidebar kiri
2. Klik **New Query**
3. Copy seluruh isi file `schema.sql`
4. Paste ke SQL Editor
5. Klik **Run** atau tekan `Ctrl+Enter`
6. Tunggu sampai selesai (akan muncul "Success")

### 3. Jalankan Seed Data (Optional)
1. Masih di SQL Editor, klik **New Query** lagi
2. Copy seluruh isi file `seed.sql`
3. Paste ke SQL Editor
4. Klik **Run**
5. Data sample akan terisi

### 4. Dapatkan Kredensial
1. Klik **Settings** (icon gear) di sidebar
2. Klik **API** di menu Settings
3. Copy 2 nilai ini:
   - **Project URL** (contoh: `https://xxxxx.supabase.co`)
   - **anon public** key (di bagian Project API keys)

### 5. Setup Environment Variables
1. Buat file `.env.local` di root project (jika belum ada)
2. Tambahkan kredensial:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Save file
4. Restart development server (`npm run dev`)

### 6. Verifikasi
1. Buka aplikasi di browser
2. Check console untuk pesan koneksi Supabase
3. Data dari Supabase seharusnya muncul di dashboard

## Struktur Database

### Tables
- `projects` - Data project utama
- `activities` - Kegiatan per project
- `weekly_progress` - Progress mingguan
- `monthly_progress` - Progress bulanan
- `s_curve_baseline` - Data baseline S-Curve
- `s_curve_actual` - Data actual S-Curve

### Views
- `project_summary` - Summary project dengan statistik
- `latest_scurve_data` - Data S-Curve terbaru per project

## Troubleshooting

### Error: "relation does not exist"
- Pastikan schema.sql sudah dijalankan dengan sukses
- Check di Table Editor apakah tabel sudah terbuat

### Error: "Invalid API key"
- Pastikan VITE_SUPABASE_ANON_KEY benar
- Jangan gunakan service_role key untuk frontend

### Data tidak muncul
- Check RLS policies sudah enabled
- Pastikan seed.sql sudah dijalankan
- Check console browser untuk error messages
