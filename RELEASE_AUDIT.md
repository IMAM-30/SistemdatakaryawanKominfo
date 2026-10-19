# Audit sebelum release — 18 Oktober 2026

Audit awal mencakup perubahan PDF, daftar 10+10, frontend responsif, login Admin/Portal, interaksi dashboard, akses data/foto, dan dependensi. Status awal saat audit: perubahan lokal, belum dideploy. Status setelah diagnosis sinkronisasi production dicatat di bagian terakhir.

## Temuan dan perbaikan

| Temuan yang dibuktikan | Perbaikan | Pengaman regresi |
| --- | --- | --- |
| Endpoint foto publik/Portal menerima ID foto tanpa memeriksa izin field, pegawai pemilik yang masih aktif, dan foto yang sedang terpasang. Referensi foto tersembunyi juga masih dikirim dalam data pegawai. | Pemeriksaan otorisasi sebelum membaca Drive; kategori/pegawai arsip atau nonaktif disembunyikan dari pembaca; `photoFileId` hanya diberikan sesuai izin foto. Akses Admin tetap tersedia. | 37 tes kontrak `tests/reader-privacy.test.ts`; 25 skenario awal gagal pada kode lama. |
| Escape pada konfirmasi bertumpuk menutup formulir induk, membuang draft, dan meninggalkan scroll terkunci. | Pengelolaan urutan dialog, fokus, ID aksesibilitas unik, dan pemulihan scroll. Konfirmasi tidak bisa ditutup saat menyimpan. Fullscreen foto mengikuti urutan dialog. | Pembatalan, fokus Tab, penyimpanan berhasil, respons 503, dan retry terkontrol. |
| Pencarian global kedua tidak diterapkan ketika Data Pegawai sudah terbuka. | Setiap submit menerapkan pencarian kembali, termasuk query sama dan pengosongan pencarian. | Regresi pencarian berulang. |
| Menu mobile yang tersembunyi tetap menerima fokus Tab di luar layar. | Menu tertutup juga disembunyikan dari fokus dan accessibility tree; drawer desktop/mobile tetap dapat berganti. | Navigasi keyboard dan resize. |
| Landing page menampilkan hasil kosong saat data masih dimuat; pegawai dari kategori nonaktif/arsip/hilang masih dapat tampil. | Status memuat dipertahankan sampai data lengkap; kategori dan field publik disaring sebelum render/pencarian. | Request lambat, error, mode PUBLIC/LOGIN_REQUIRED/CLOSED, dan kategori tersembunyi. |
| Browser yang menolak localStorage dapat menggagalkan login atau membuat kontrol tema crash. | Penyimpanan preferensi menjadi opsional; login, pengalihan sesi, tema, dan ukuran teks tetap bekerja. | Login Admin/Portal dengan storage ditolak. |
| Avatar menampilkan foto sebelumnya setelah ID foto berubah atau dihapus. | State foto mengikuti ID dan sumber akses; cache dan respons terlambat tidak mengganti foto yang sedang dipilih. | Refresh, penggantian foto tercache, penghapusan, dan request terlambat. |
| Snapshot tanpa kategori menghasilkan file kosong. | Unduhan dihentikan dengan pesan yang jelas sebelum membuat PDF/Excel. | Ketiga pilihan format, termasuk seluruh kategori diarsipkan. |
| `master.cookies` tidak diabaikan Git. | Aturan `*.cookies` ditambahkan di luar blok otomatis FRIDAY. Isi cookie tidak dibaca. | `git check-ignore`; tidak ada cookie yang tercatat sebagai file tracked atau unignored. |

## Dependensi

- Next.js dan konfigurasi ESLint diperbarui dari 16.3.6 ke 16.3.8. Lihat [advisori resmi Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4). Konfigurasi proyek ini tidak memakai remote image patterns yang menjadi syarat serangan SSRF tersebut; pembaruan tetap menutup versi yang ditandai audit.
- `source-map-js` diperbarui ke 1.2.2 dan dependensi pengembangan transitif MCP SDK ke 1.32.1; versi terkunci dalam `package-lock.json`.
- `npm audit --omit=dev`: **0 temuan**.
- Audit seluruh dependensi: **6 entri high**, semuanya berasal dari rantai dependensi pengembangan `braces` melalui tooling ESLint/clasp. `braces@3.0.3` masih merupakan versi terbaru yang tersedia saat audit dan masih ditandai [advisori ini](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Saran otomatis npm melibatkan downgrade mayor tooling; tidak diterapkan karena berisiko merusak kompatibilitas. Temuan ini tetap terbuka pada tooling/build, bukan dependensi runtime produksi.

## Verifikasi

- `npm ci`: berhasil memasang dependensi dari lockfile.
- `git diff --check`: lolos.
- `npm run check`: lolos lint tanpa warning, TypeScript, **85 tes unit/kontrak**, verifikasi sintaks **12 file Apps Script**, production build Next.js 16.3.8, dan **38 E2E Chromium**.
- `npm run test:e2e -- --browser=webkit --workers=2`: **38 E2E WebKit lolos**. Regresi fokus dialog menggunakan aktivasi keyboard eksplisit dan juga diverifikasi ulang di Chromium; tidak bergantung pada perilaku fokus klik pointer yang berbeda antarbrowser.
- Tes PDF mencakup grid sel, halaman lanjutan, data panjang, kategori kosong, serta unduhan langsung PDF/Excel. Audit tambahan 250 pegawai × 22 kolom menghasilkan 28 halaman tanpa sel keluar batas atau halaman kosong.
- Tes UI mencakup ponsel kecil, tablet, desktop, landscape pendek, tema terang/gelap, data panjang, login, tabel 10+10, formulir, dan dialog.
- Pemindaian pola private key/token pada 91 file teks yang dapat masuk Git tidak menemukan kecocokan. Ini pemeriksaan pola terbatas, bukan jaminan menyeluruh atas semua jenis rahasia.

## Syarat release

1. **Release ini memerlukan pembaruan Apps Script juga.** Publikasikan `apps-script/DomainService.gs` dan `apps-script/PhotoService.gs` sebagai versi baru pada deployment Web App yang sudah aktif. Deploy Vercel saja tidak menerapkan perbaikan izin backend. Tidak diperlukan migrasi atau perubahan struktur data.
2. Sertakan source, stylesheet baru, tes, `package.json`, `package-lock.json`, dan `.gitignore` dalam commit. Perubahan README dari catatan otomatis sebelumnya dipertahankan; tinjau tersendiri sebelum memasukkannya ke commit.
3. Setelah deployment Apps Script dan Vercel, jalankan smoke test production untuk health, login setiap peran, akses foto yang diizinkan/ditolak, CRUD, dan unduhan. Tes lokal memakai fixture; audit ini belum membuktikan integrasi Google/Drive/Vercel yang baru di production.

## Perbaikan sinkronisasi production — 18 Oktober 2026 malam

- Bukti awal: `employees.publicList` melalui Vercel gagal dengan HTTP 504 / `BACKEND_TIMEOUT` pada 12,44 detik; permintaan signed langsung ke Google belum selesai setelah 60 detik. Health dan settings tetap berhasil sekitar 2–3 detik.
- Penyebab yang dibuktikan: pemetaan setiap pegawai membaca seluruh FIELDS lagi. Fixture 300 pegawai menghasilkan 300 pembacaan FIELDS; setelah perbaikan hanya sekali. Read-only request juga tidak lagi memindai riwayat IDEMPOTENCY.
- Snapshot sheet hanya berlaku di dalam satu read request. Mutasi tetap membaca versi terkini, cache dibersihkan saat selesai, dan pemeriksaan konflik versi, privasi, sesi serta mode portal memiliki tes regresi.
- Uji beberapa action Admin bersamaan masih menunjukkan antrean panjang. `dashboard.snapshot` menggabungkan data dashboard menjadi satu action dengan satu pembacaan per sheet, tetap menggunakan handler dan batas akses lama. Action lama tetap tersedia.
- Dashboard lokal kini menangani load gagal dengan tombol coba lagi, mempertahankan data terakhir saat refresh gagal, dan tidak menampilkan angka nol atau pesan sinkronisasi berhasil palsu. Timeout transport mencakup pembacaan body JSON, bukan hanya header. Batas Google tetap 12 detik; mutasi tidak diulang otomatis.
- Apps Script aktif sudah diperbarui dari versi 4 ke **versi 6**, pada deployment/URL yang sama. Akses `ANYONE_ANONYMOUS`, eksekusi `USER_DEPLOYING`, dan schema 2 dipertahankan. Source dan konfigurasi sebelumnya dicadangkan; tidak ada migrasi atau perubahan data pegawai.
- Hasil live setelah perbaikan: Vercel mengambil **79 pegawai publik dalam 2,41 detik**. Signed snapshot Google: Admin 3,80 detik (80 data termasuk arsip/nonaktif), Master 3,62 detik, Portal 2,72 detik (79 data). Ini pengukuran beberapa permintaan, bukan jaminan latensi tetap. Probe Admin/Master/Portal memakai actor diagnostik dari sisi server tepercaya; bukan login browser pengguna sebenarnya.
- Browser production pada lebar 480 dan 1440 px berhasil menampilkan tabel 10 baris lalu 20, tanpa overflow atau exception JavaScript; seluruh request data/foto yang diamati HTTP 200. Waktu tabel siap sekitar 6,1–6,9 detik pada frontend production sebelum pembaruan snapshot.
- `npm run check`: lint, TypeScript, **123 tes unit/kontrak**, sintaks 12 file Apps Script, build, dan **45 E2E Chromium** lolos. `npm run test:e2e -- --browser=webkit --workers=2`: **45 E2E WebKit** juga lolos. Tes mencakup payload actor palsu, akses tanpa sesi, role Portal, cache mutasi, timeout/body malformed, retry serta satu snapshot per refresh.
- Pembaruan Next.js/dashboard belum dideploy pada saat catatan ini ditulis: CLI Vercel terautentikasi ke akun `watangsoreangith-1420`/team `watangsoreang`, yang tidak memiliki proyek Kominfo. Menunggu pilihan pemilik untuk commit/push perubahan terpilih atau login CLI dengan akun proyek yang benar. README dan perubahan `.gitignore` yang sudah ada tidak disertakan otomatis.
