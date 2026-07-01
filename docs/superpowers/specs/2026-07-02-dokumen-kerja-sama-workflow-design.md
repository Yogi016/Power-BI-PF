# Dokumen Kerja Sama Workflow Design

Tanggal: 2026-07-02
Repo: Power-BI-PF

## Tujuan

Meningkatkan dashboard manajemen Fungsi Lingkungan agar lebih sesuai dengan pekerjaan nyata tim: kerja sama PKS/MOU, proyek penanaman, monitoring, perhutanan sosial, dan task project lainnya.

Fase pertama berfokus pada modul Dokumen Kerja Sama yang berdiri sendiri, tetapi tetap bisa masuk ke dalam project sebagai task otomatis berbobot.

## Prinsip Produk

- Tidak semua project memiliki PKS/MOU.
- PKS/MOU adalah dokumen kerja sama yang berdiri sendiri, bukan sekadar file upload.
- Jika PKS/MOU terkait dengan project, dokumen tersebut harus muncul sebagai task project otomatis.
- Dokumen kerja sama menjadi sumber utama workflow. Task project mengikuti status dokumen.
- Approval VP Lingkungan wajib untuk semua PKS/MOU dan dokumen kerja sama sejenis.
- Legal/Internal Review cukup dicatat sebagai status dan catatan, bukan role user terpisah.
- Draft dan final document harus disimpan sebagai version history.

## Role

Sistem memakai 4 role utama:

- VP Lingkungan
- Project Manager
- Project Head
- Staff Officer

Role ini mengatur dashboard, task inbox, dan hak aksi workflow. Role legal tidak dibuat pada fase ini.

## Visibilitas Halaman

Halaman Dokumen tetap terlihat untuk semua role. Perbedaan role diterapkan pada aksi, default filter, dan scope data, bukan pada keberadaan menu halaman.

- VP Lingkungan dapat melihat seluruh dokumen kerja sama dan melakukan approval final.
- Project Manager dapat melihat dokumen dalam portfolio yang dikelola dan melakukan validasi.
- Project Head dapat melihat dokumen pada project atau program yang menjadi tanggung jawabnya dan melakukan review substansi.
- Staff Officer dapat melihat dokumen yang dibuat atau ditugaskan kepadanya, membuat draft, upload versi dokumen, dan melengkapi metadata.

Jika fase berikutnya membutuhkan pembatasan dokumen sensitif, pembatasan tersebut dilakukan di level record dan aksi, bukan dengan menyembunyikan halaman Dokumen sepenuhnya.

## Jenis Pekerjaan

Project dapat dikelompokkan dengan jenis pekerjaan berikut:

- Kerja Sama
- Penanaman
- Monitoring
- Perhutanan Sosial
- Task Lainnya

Jenis pekerjaan membantu dashboard menampilkan indikator yang relevan. Penanaman cocok dengan progress, S-Curve, target realisasi, manpower, obstacle, dan action plan. Kerja sama lebih cocok dengan status dokumen, approval, masa berlaku, dan kewajiban kerja sama.

## Modul Dokumen Kerja Sama

Dokumen Kerja Sama adalah registry berdiri sendiri untuk:

- PKS
- MOU
- MoA
- Addendum
- BAST
- NDA
- SK
- Surat dukungan
- Dokumen kerja sama lain

Field utama:

- Nama dokumen
- Jenis dokumen
- Mitra
- Nomor dokumen
- Tanggal mulai
- Tanggal berakhir
- Status workflow
- PIC internal
- Project terkait, opsional
- Ringkasan ruang lingkup
- Catatan legal/internal
- Catatan mitra
- Catatan approval
- File aktif
- Version history
- Audit trail

## Workflow Status

Status detail dokumen:

1. Usulan
2. Draft Internal
3. Review Project Head
4. Review Legal/Internal
5. Review Mitra
6. Revisi Final
7. Validasi Project Manager
8. Menunggu Approval VP
9. Disetujui VP
10. Siap TTD
11. Proses TTD
12. Aktif
13. Monitoring Implementasi
14. Selesai
15. Expired
16. Diperpanjang
17. Diarsipkan

Aturan approval:

- Staff Officer dapat membuat draft dan upload versi dokumen.
- Project Head melakukan review substansi program.
- Project Manager melakukan validasi kelayakan dan kelengkapan.
- VP Lingkungan wajib melakukan approval final.
- Dokumen tidak dapat masuk status Siap TTD, Proses TTD, atau Aktif sebelum Disetujui VP.
- Reject dari Project Head, Project Manager, atau VP mengembalikan dokumen ke tahap revisi dengan catatan wajib.

## Version History

Setiap dokumen kerja sama dapat memiliki banyak versi file:

- Draft v1
- Draft v2
- Draft v3
- Final Draft
- Dokumen Signed

Metadata setiap versi:

- Nama file
- URL file
- Version label
- Uploader
- Tanggal upload
- Status dokumen saat upload
- Catatan revisi
- Sumber revisi: internal, Project Head, Project Manager, VP, atau mitra

File terbaru menjadi file aktif, tetapi file lama tetap tersimpan sebagai riwayat.

## Integrasi Ke Project

Dokumen kerja sama dapat dihubungkan ke project. Jika terhubung, sistem otomatis membuat task package PKS/MOU di project.

Template task otomatis:

1. Inisiasi PKS/MOU
2. Penyusunan Draft
3. Review Project Head
4. Review Legal/Internal
5. Review Mitra
6. Revisi Final
7. Validasi Project Manager
8. Approval VP Lingkungan
9. Proses TTD
10. Upload Dokumen Final
11. Monitoring Implementasi Kerja Sama

Aturan sinkronisasi:

- Status dokumen menjadi sumber utama.
- Task project otomatis mengikuti status dokumen.
- Step sebelum status saat ini menjadi completed.
- Step saat ini menjadi in-progress.
- Step setelah status saat ini menjadi not-started.
- Jika dokumen reject atau perlu revisi, task terkait kembali in-progress atau delayed dengan catatan revisi.
- Status dan bobot task otomatis tidak diedit manual dari halaman project.
- Task otomatis tetap boleh memiliki catatan tambahan.

Mapping status ke task aktif:

- Usulan mengaktifkan task Inisiasi PKS/MOU.
- Draft Internal mengaktifkan task Penyusunan Draft.
- Review Project Head mengaktifkan task Review Project Head.
- Review Legal/Internal mengaktifkan task Review Legal/Internal.
- Review Mitra mengaktifkan task Review Mitra.
- Revisi Final mengaktifkan task Revisi Final.
- Validasi Project Manager mengaktifkan task Validasi Project Manager.
- Menunggu Approval VP dan Disetujui VP mengaktifkan task Approval VP Lingkungan sampai approval final tersimpan.
- Siap TTD dan Proses TTD mengaktifkan task Proses TTD.
- Aktif mengaktifkan task Upload Dokumen Final jika dokumen signed belum tersedia, lalu task Monitoring Implementasi Kerja Sama setelah dokumen signed tersedia.
- Monitoring Implementasi mengaktifkan task Monitoring Implementasi Kerja Sama.
- Selesai, Expired, Diperpanjang, dan Diarsipkan menyelesaikan task dokumen yang masih relevan dan mengunci workflow utama.

## Bobot Progress Project

Aturan bobot:

- Project tanpa PKS/MOU tidak memiliki package dokumen kerja sama.
- Project dengan PKS/MOU memakai pool dokumen kerja sama tetap 20%.
- Aktivitas implementasi project non-dokumen otomatis diturunkan menjadi total 80%.
- Semua aktivitas lama diturunkan proporsional, termasuk aktivitas completed.
- Status dan progress aktivitas lama tidak berubah.
- Total bobot project selalu dijaga 100%.

Contoh penurunan proporsional:

- Aktivitas A 40% menjadi 32%.
- Aktivitas B 35% menjadi 28%.
- Aktivitas C 25% menjadi 20%.
- Pool PKS/MOU menjadi 20%.

Jika satu project memiliki lebih dari satu dokumen kerja sama:

- Pool tetap 20%.
- Dokumen dibagi rata otomatis.
- 1 dokumen: 20%.
- 2 dokumen: 10% + 10%.
- 3 dokumen: 6.67% + 6.67% + 6.66%.

Pembagian bobot di dalam satu dokumen kerja sama mengikuti persentase dari bobot dokumen tersebut:

- Inisiasi PKS/MOU: 10%.
- Penyusunan Draft: 15%.
- Review Project Head: 10%.
- Review Legal/Internal: 10%.
- Review Mitra: 10%.
- Revisi Final: 10%.
- Validasi Project Manager: 10%.
- Approval VP Lingkungan: 10%.
- Proses TTD: 10%.
- Upload Dokumen Final: 5%.
- Monitoring Implementasi Kerja Sama tidak menambah bobot dokumen awal. Task ini menjadi follow-up operasional setelah dokumen aktif.

Jika dokumen kerja sama terakhir dilepas dari project:

- Pool dokumen 20% dihapus dari project tersebut.
- Aktivitas implementasi non-dokumen dinaikkan kembali proporsional menjadi total 100%.
- Task otomatis PKS/MOU diarsipkan, bukan dihapus, agar audit trail tetap tersedia.

## Evidence Task

File draft dan final dari modul Dokumen Kerja Sama harus tampil sebagai evidence di task project.

Aturan evidence:

- File tetap disimpan utama di modul Dokumen Kerja Sama.
- Task project menampilkan file tersebut sebagai evidence otomatis.
- User tidak perlu upload ulang ke task.
- Evidence task menampilkan Draft v1, Draft v2, Final Draft, Dokumen Signed, uploader, tanggal upload, status upload, dan catatan revisi.
- Jika file baru diupload di Dokumen Kerja Sama, evidence task otomatis ikut update.

## Dashboard Per Role

VP Lingkungan:

- Menunggu Approval VP.
- Dokumen mendesak.
- PKS/MOU hampir expired.
- Kerja sama strategis aktif.
- Proyek terlambat dan risiko tinggi.

Project Manager:

- Validasi dokumen menunggu PM.
- Bottleneck per Project Head.
- Project dengan dokumen kerja sama tertahan.
- Ringkasan portfolio kerja sama, penanaman, monitoring, perhutanan sosial, dan task lainnya.

Project Head:

- Review substansi program.
- Dokumen yang perlu revisi substansi.
- Task project per program.
- Evidence dan progress implementasi.

Staff Officer:

- Draft yang perlu dilengkapi.
- Upload versi dokumen.
- Update evidence.
- Input monitoring dan task project harian/mingguan.

## Data Model Awal

Tabel atau entitas baru yang dibutuhkan:

- cooperation_documents
- cooperation_document_versions
- cooperation_document_approvals
- cooperation_document_project_links
- project_task_links atau penanda task otomatis
- audit_events

Kolom penting cooperation_documents:

- id
- title
- document_type
- partner_name
- document_number
- start_date
- end_date
- status
- internal_pic
- scope_summary
- legal_internal_notes
- partner_notes
- current_version_id
- created_by
- created_at
- updated_at

Kolom penting cooperation_document_versions:

- id
- document_id
- version_label
- file_name
- file_url
- storage_key
- uploaded_by
- uploaded_at
- status_at_upload
- revision_notes
- revision_source

Kolom penting cooperation_document_approvals:

- id
- document_id
- approver_role
- approver_user_id
- action
- comment
- from_status
- to_status
- created_at

## Error Handling

- Jika project sudah memiliki aktivitas dengan total bobot 0, sistem tidak melakukan redistribusi otomatis dan meminta user melengkapi bobot aktivitas terlebih dahulu.
- Jika redistribusi bobot gagal, dokumen tetap dibuat tetapi link ke project tidak diaktifkan sampai bobot berhasil disinkronkan.
- Jika upload versi dokumen gagal, status workflow tidak berubah.
- Jika approval VP gagal tersimpan, status tidak boleh maju ke Disetujui VP.
- Jika task sinkronisasi gagal, sistem mencatat error dan menampilkan dokumen sebagai perlu sinkronisasi ulang.

## Testing

Unit test:

- Redistribusi bobot 100% menjadi 80% proporsional.
- Pool 20% dibagi rata untuk beberapa dokumen.
- Mapping status dokumen ke status task otomatis.
- Evidence task membaca version history dokumen.

Integration test:

- Membuat dokumen kerja sama tanpa project.
- Membuat dokumen kerja sama dengan project dan menghasilkan task otomatis.
- Upload Draft v1, Draft v2, dan Dokumen Signed.
- Approval Project Head, Project Manager, dan VP.
- Reject approval mengembalikan dokumen ke revisi dan task ikut berubah.

Verification manual:

- VP melihat inbox Menunggu Approval VP.
- Project Manager melihat validasi dokumen.
- Project Head melihat review substansi.
- Staff Officer dapat upload draft.
- Task project otomatis menampilkan evidence dokumen.

## Di Luar Scope Fase Pertama

- SLA per tahap.
- Notifikasi email atau WhatsApp.
- Kalender reminder expiry.
- Scoring prioritas dokumen strategis.
- Role Legal khusus.
- Advanced analytics kerja sama.

Fitur tersebut dapat masuk fase berikutnya setelah workflow dasar stabil.
