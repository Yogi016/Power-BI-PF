# ProTrack Analytics
Dashboard progres proyek dengan visualisasi S-Curve, timeline mingguan, dan pengelolaan data terpusat.

## Fitur utama
- **Dashboard**
  - S-Curve dengan toggle Bulanan/Mingguan dan batang target mingguan.
  - Filter Proyek, PIC, Tahun, dan kategori proyek (Mahakam/Bontang/Blora/Lain-lain).
  - Resource allocation donut, KPI kartu, dan tabel Activity Breakdown.
  - Scroll ke “Full Schedule” untuk melihat ringkasan mingguan + timeline.
- **Manage Data**
  - Import CSV (`public/data/scurve-user.csv` atau `scurve-final.csv`) untuk memuat proyek + data mingguan.
  - Edit S-Curve Metrics (plan/actual) manual; ketika diubah, dashboard memakai data manual.
  - Tambah/edit/hapus Activity (kode, PIC, status, weight, progress, tahun/bulan/minggu).
  - Kelola opsi filter proyek (Semua Proyek, Mahakam, Bontang, Blora, Lain-lain, dan custom).
- **Data model**
  - `ProjectData` berisi aktivitas dengan `weeklyProgress` (minggu 1–4 per bulan, Juni–Maret).
  - `WeeklyData` menyimpan baseline & actual kumulatif per minggu, termasuk tahun.
  - `TaskItem` memiliki `weight` (bobot % kontribusi) untuk agregasi progress.

## Struktur data & file
- **CSV sumber**: `public/data/scurve-user.csv` (prioritas) atau `public/data/scurve-final.csv`.
- **Parser**: `utils/csvParser.ts` mengubah CSV menjadi `projects`, `weeklySummary`, dan konversi ke bulanan.
- **State global**: `context/DataContext.tsx`.
- **Komponen utama**:
  - Dashboard: `pages/Dashboard.tsx`
  - Manage Data: `pages/ManageData.tsx`
  - Chart: `components/SCurveChart.tsx`, `components/WeeklySummaryTable.tsx`, `components/WeeklyTimeline.tsx`, `components/PICDonutChart.tsx`

## Menjalankan lokal
1) `npm install`  
2) `npm run dev` lalu buka URL yang ditampilkan (Vite default `http://localhost:5173`).  
3) (Opsional) set `GEMINI_API_KEY` di `.env.local` jika ingin dipakai di masa depan; saat ini tidak wajib.

## Alur penggunaan
1) Buka **Manage Data**:
   - Import CSV untuk memuat proyek + data mingguan.
   - Atau edit S-Curve Metrics manual (plan/actual) untuk override data mingguan.
   - Tambah/edit aktivitas (kode, PIC, status, weight, progress, tahun/bulan/minggu).
2) Buka **Dashboard**:
   - Pilih Proyek/PIC/Tahun atau kategori proyek.
   - Toggle Bulanan/Mingguan pada kartu S-Curve; batang “Target Mingguan” menunjukkan delta baseline per minggu.
   - Klik “View Full Schedule” untuk lompat ke ringkasan mingguan & timeline.

## Catatan penting
- Pastikan weight aktivitas per proyek mendekati 100% agar agregasi progres lebih akurat.
- Jika baseline per proyek diperlukan, CSV harus memuat baseline per proyek; saat ini baseline bersifat agregat.
- Logo diambil dari `public/pf-logo.png`.***
