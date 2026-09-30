# Sistem Data Karyawan Kominfo Parepare

Backend aman untuk pengelolaan PNS, PPPK, dan Non-PNS. Arsitektur: browser → Next.js BFF di Vercel → request HMAC → Apps Script → Google Sheets/Drive privat.

## Pengembangan lokal

1. Jalankan `npm install`.
2. Salin `.env.example` ke `.env.local` dan isi secret hasil `node scripts/generate-secrets.mjs`.
3. Isi `APPS_SCRIPT_URL` setelah Web App Apps Script selesai dideploy.
4. Jalankan `npm run dev`.

Validasi lengkap: `npm run check`.

## Persiapan Google

1. Sinkronisasi source menggunakan project ID pada `.clasp.json`: `npx clasp -u kominfo push`.
2. Pada **Project Settings → Script Properties**, isi `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `HMAC_SECRET`, dan `BOOTSTRAP_SECRET`. Jangan memasukkan nilainya ke source.
3. Jalankan `setupProject()` dari editor. Fungsi ini idempoten; eksekusi kedua harus berhasil tanpa menggandakan kategori atau field.
4. Saat fase deployment backend dimulai, deploy sebagai Web App, execute as owner, gunakan URL `/exec`, dan buat deployment version baru setiap perubahan source.
5. Masukkan secret yang sama ke Vercel Environment Variables. Jangan memakai prefix `NEXT_PUBLIC_`.
6. Buat Admin Master pertama melalui `POST /api/setup/bootstrap-master` dengan header `x-bootstrap-secret`; endpoint otomatis menolak bootstrap kedua.

Deployment dan perubahan izin Google sengaja belum dilakukan karena akan dikerjakan sendiri oleh pemilik proyek.

## Release ke Vercel

1. Jalankan `npm ci` lalu `npm run check` sebelum commit release.
2. Setelah source Apps Script berubah, jalankan `npx clasp push`, buat versi baru, lalu arahkan deployment Web App aktif ke versi tersebut.
3. Hubungkan repository ke Vercel dan gunakan preset Next.js dengan Node.js 20 atau lebih baru.
4. Isi `APP_ENV=production`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_HMAC_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `BOOTSTRAP_SECRET`, dan `SESSION_COOKIE_NAME` pada Environment Variables Vercel.
5. Tandai HMAC secret, encryption key, dan bootstrap secret sebagai sensitive. Jangan memakai prefix `NEXT_PUBLIC_`.
6. Setelah deploy, periksa `/api/health`, login akun Portal melalui `/login`, login Admin Kominfo dan Admin Master melalui `/admin`, CRUD pegawai, upload foto, akun, mode portal, ekspor Excel/PDF, serta tampilan mobile.

File `.env.local`, `*.cookies`, `.vercel`, hasil build, dan hasil test otomatis diabaikan Git.

<!-- FRIDAY:PROJECT-RESOURCE:START -->
<!-- Maintained for FRIDAY system readers. Keep the fenced JSON valid. -->
```json
{
  "schema": "friday.project.resource.v1",
  "owner": "FRIDAY",
  "audience": "system",
  "purpose": "Machine-readable project context anchor for FRIDAY startup onboarding and resource brain.",
  "createdAt": "2026-09-30T00:07:15.510Z",
  "rules": [
    "Use existing project files and resources when they are present.",
    "Create missing files or resources conservatively when no suitable existing target exists.",
    "When adding or revising content inside an existing file, keep FRIDAY-owned content inside a clearly marked FRIDAY block or section.",
    "Do not overwrite human-authored content outside the FRIDAY marker unless Imam explicitly asks."
  ],
  "notes": [
    {
      "id": "md-20260928064218-5w17az",
      "ts": "2026-09-28T06:42:18.695Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "template",
      "status": "completed",
      "prompt": "Oke friday, jadi hari ini kita mau bangun sistem di dinas kominfo, jadi berupa website yakni berupa database karyawan atau pegawai di dinas Kominfo Parepare, dimana datanya sebagai berikut : ada 3 jenis data, yakni data : - Pegawai Negeri Sipil (PNS) dengan urutan data yakni : - Nomor (ini nanti untuk urutan ketika di tampilkan pada table) - Foto - NIP - Nama - Tempat Lahir (Kabupaten/Kota) - Tanggal Lahir - Jenis Kelamin - Agama - Alamat Kota/Kabupaten - Golongan/Pangkat CPNS - TMT Golongan/Pangkat CPNS - Jabatan - Eselon - TMT Eselon - Golongan/Pangkat (Terakhir) - TMT Golongan/Pangkat (Terakhir) - TMT Golongan/Pangkat (Terakhir) - KGB - KGB Berikutnya - Masa Kerja Tahun - Masa Kerja Bula…",
      "summary": "Saya sudah paham, Imam. Sistem ini adalah database pegawai Kominfo Parepare dengan tiga kategori—PNS, PPPK, dan Non-PNS—serta tiga level akses: Admin Master, Admin Kominfo, dan akun Portal. Backend perlu mendukung CRUD data, kolom dinamis, akun, aktivasi portal/kategori/kolom, foto di Google Drive, dan data utama di Google Sheets melalui Apps Script.",
      "changes": [
        "Saya menyarankan data memakai soft delete, sehingga bisa dipulihkan, serta mencatat siapa yang menambah/mengubah/menghapus data dan kapan.",
        "Apakah dibutuhkan juga riwayat perubahan dan ekspor Excel/PDF?",
        "Belum ada file atau layanan yang saya ubah pada tahap ini."
      ],
      "files": [],
      "verification": [],
      "avoid": [],
      "durationMs": 35626
    },
    {
      "id": "md-20260928070104-sr3m0b",
      "ts": "2026-09-28T07:01:04.425Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "template",
      "status": "completed",
      "prompt": "1. tidak apa apa bisa dilihat oleh admin master, ini hanya website masih dalam tahapan pengembangan. 2. tidak apa apa, makanya itu penting ada akun portal. 3. portal yang saya maksud ini ke data atau landing page umum, sebenarnya websitenya ini nanti umum tapi saya mau bisa kita buatkan portal. 4. ia dia dapat membuat semuanya, full custom. 5. TMT Eselon dan TMT Golongan/Pangkat (Terakhir) , iya KGB sudah benar 6. iya, untuk kedua jenis data itu memang hanya itu, makanya pada admin nanti bisa custom tambahkan coulumn baru. 7. atur saja bagaimana baiknya, saranmu juga bisa saya terima. 8. ya semua admin kominfo sederajat. 9. oke saya terima saranmu dan terapkan saja 10. link spreadsheet : ht…",
      "summary": "Saya paham. Kebutuhan utamanya sudah cukup jelas dan kita akan menggunakan Next.js + TypeScript untuk Vercel, dengan backend server/BFF yang terhubung secara aman ke Apps Script, Google Sheets, dan Drive privat.",
      "changes": [
        "PNS memiliki struktur lengkap; PPPK dan Non-PNS memakai lima data awal tetapi bisa ditambah kolom secara dinamis.",
        "Soft delete, audit log, riwayat perubahan, pemulihan data, dan ekspor Excel/PDF akan diterapkan."
      ],
      "files": [],
      "verification": [],
      "avoid": [],
      "durationMs": 26625
    },
    {
      "id": "md-20260928072008-cpod3o",
      "ts": "2026-09-28T07:20:08.275Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "Kerjakan backend-nya sekarang friday",
      "summary": "Saya mulai backend sekarang. Saya akan memakai panduan Google Full-Stack Launcher untuk memilih arsitektur aman Next.js BFF → Apps Script → Sheets/Drive, lalu TDD untuk mengunci kontrak, autentikasi, hak akses, kolom dinamis, dan audit sebelum implementasi. Pertama saya audit repo serta membaca pola arsitektur/backend yang diwajibkan; setelah itu baru scaffold dan menulis tes awal.Audit menunjukkan repo masih kosong—belum ada framework, backend, atau tes—jadi saya membangun fondasi produksi dari nol, bukan menambal proyek lama. Arsitektur yang dipakai adalah Next.js BFF karena NIP, tanggal lahir, alamat, foto, dan kredensial termasuk data sensitif; Apps Script tetap menjadi lapisan data oto…",
      "changes": [
        "Setelah selesai saya akan memastikan tes gagal karena modul keamanan belum ada—itu menjadi baseline “red”—lalu saya implementasikan BFF dan Apps Script sampai seluruh tes hijau.Baseline “red” berhasil: ketiga suite gagal tepat karena modul…",
        "Integrasi langsung ke Spreadsheet/Drive masih sengaja tidak dijalankan karena Apps Script belum dideploy dan perubahan resource Google memerlukan langkah pemilik akun.Audit mencapai 17/18; satu-satunya warning adalah belum ada E2E.",
        "Saya batasi unit test ke tests//.test.ts, lalu menjalankan ulang seluruh pipeline termasuk Playwright secara terpisah.Backend inti sudah selesai dibangun secara lokal dan siap dihubungkan ke Google Apps Script.",
        "Tidak ada resource Google atau izin eksternal yang saya ubah."
      ],
      "files": [
        "Google/Vercel.Semua",
        "Spreadsheet/Drive masih sengaja tidak dijalankan karena Apps Script belum dideploy dan perubahan resource Google memerlukan langkah pemilik akun.Audit",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/README.md",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/apps-script/API_CONTRACT.md",
        "crypto.scrypt",
        "tests/**/*.test.ts",
        "README.md",
        "API_CONTRACT.md"
      ],
      "verification": [
        "Setelah tes benar-benar gagal, baru implementasinya saya isi.Tes keamanan awal sudah ditulis dan instalasi dependency sedang berlangsung; proses npm lebih lambat dari normal tetapi masih aktif.",
        "Sekarang saya mengisi lapisan server—crypto kredensial, otorisasi berbasis role, signing HMAC, cookie session/CSRF, proxy Apps Script, endpoint login/logout/bootstrap, dan gateway CRUD—serta halaman root minimal hanya agar backend dapat di…",
        "Saya rapikan wrapper tersebut sekarang, lalu menambah verifier Apps Script, contoh environment tanpa secret, kontrak API, dan tes validasi skema agar backend tidak hanya lolos tes unit tetapi juga siap dipasang ke Google/Vercel.Semua 7 tes…",
        "Lint menemukan masalah kompatibilitas tooling, bukan kode: TypeScript 7 terbaru belum didukung oleh typescript-eslint bawaan Next 16.",
        "Saya akan mengunci TypeScript ke rilis 6.x yang kompatibel, lalu menjalankan kembali lint dan production build; setelah itu saya audit celah kontrak/otorisasi yang mungkin belum tertutup tes.Production build sudah lulus.",
        "Audit regresi lanjutan menemukan beberapa celah yang build biasa tidak bisa menangkap: field yang disembunyikan masih berpotensi ikut terkirim pada respons publik, daftar admin dapat memuat akun Master, reset password Portal belum memiliki…",
        "Saya sedang menutup empat jalur ini serta menambahkan idempotency untuk retry mutation sebelum menjalankan gate akhir.Gate utama kini hijau: lint, typecheck, 8 tes, verifier Apps Script, dan production build semuanya lulus.",
        "Saya juga membersihkan artefak build lokal dari calon Git tracking.E2E pertama mengungkap konflik runner: Vitest ikut mengambil file Playwright karena pola default terlalu luas."
      ],
      "avoid": [
        "Tes awal menargetkan tiga risiko terbesar: password harus hash + terenkripsi (bukan plaintext), role tidak boleh melampaui haknya, dan payload ke Apps Script harus ditandatangani deterministik agar anti-replay dapat diverifikasi.",
        "Setelah tes benar-benar gagal, baru implementasinya saya isi.Tes keamanan awal sudah ditulis dan instalasi dependency sedang berlangsung; proses npm lebih lambat dari normal tetapi masih aktif.",
        "Setelah selesai saya akan memastikan tes gagal karena modul keamanan belum ada—itu menjadi baseline “red”—lalu saya implementasikan BFF dan Apps Script sampai seluruh tes hijau.Baseline “red” berhasil: ketiga suite gagal tepat karena modul…",
        "Ini bukan kegagalan backend, tetapi pemisahan test suite yang belum tegas.",
        "Tes awal gagal karena modul credential, authorization, dan HMAC signing belum tersedia—sesuai alur TDD.",
        "Instruksi berikut yang paling tepat: “Hubungkan backend lokal ini ke Apps Script dan siapkan migrasi Google Sheets, tetapi jangan deploy Vercel.”"
      ],
      "durationMs": 1066425
    },
    {
      "id": "md-20260928073201-ip2zhk",
      "ts": "2026-09-28T07:32:01.070Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "Hubungkan backend lokal ini ke Apps Script dan siapkan migrasi Google Sheets, dan jangan deploy Vercel",
      "summary": "Saya akan menghubungkan source lokal ke project Apps Script yang Imam berikan, menjalankan migrasi idempoten pada Spreadsheet, lalu melakukan health/read check—tanpa menyentuh Vercel. Saya memakai Google Full-Stack Launcher untuk menjaga konfigurasi Sheets/Drive tetap aman, TDD untuk melindungi kontrak yang sudah hijau, dan browser automation karena tahap ini perlu mengoperasikan Apps Script/Google secara langsung. Pertama saya cek metode koneksi (clasp/session Google), status project, serta panduan Next.js yang diwajibkan repo sebelum ada perubahan.Koneksi browser terintegrasi yang diperlukan tidak tersedia pada sesi ini, jadi saya beralih ke CLI resmi Google Apps Script (clasp) agar perub…",
      "changes": [
        "Pertama saya cek metode koneksi (clasp/session Google), status project, serta panduan Next.js yang diwajibkan repo sebelum ada perubahan.Koneksi browser terintegrasi yang diperlukan tidak tersedia pada sesi ini, jadi saya beralih ke CLI re…",
        "Sebelum push, saya memperbaiki pola .claspignore agar hanya 12 file .gs dan manifest yang ikut, lalu saya tarik source remote ke folder sementara untuk membandingkan isi dan menghindari overwrite buta.Remote project sudah saya verifikasi: …",
        "Saya akan push 12 modul backend + manifest sekarang; ini mengganti placeholder tersebut, tetapi belum mengubah deployment Web App atau izin akses.Source remote sudah terpasang.",
        "Mohon selesaikan persetujuan Google yang terbuka di browser menggunakan akun pemilik Spreadsheet/Drive (kemungkinan imamhudzaifah@gmail.com); setelah disetujui saya lanjut otomatis.Halaman persetujuan Google sudah saya buka di browser."
      ],
      "files": [
        ".env.local",
        "digitalwatangsoreang@gmail.com",
        "imamhudzaifah@gmail.com"
      ],
      "verification": [
        "Saya akan menghubungkan source lokal ke project Apps Script yang Imam berikan, menjalankan migrasi idempoten pada Spreadsheet, lalu melakukan health/read check—tanpa menyentuh Vercel."
      ],
      "avoid": [
        "Sebelum push, saya memperbaiki pola .claspignore agar hanya 12 file .gs dan manifest yang ikut, lalu saya tarik source remote ke folder sementara untuk membandingkan isi dan menghindari overwrite buta.Remote project sudah saya verifikasi: …",
        "Fungsi ini sekaligus membuat tab, header, setting awal, tiga kategori, dan field default secara idempoten.Migrasi mencapai fungsi remote tetapi Google mengembalikan NOTFOUND saat membuka resource—ini biasanya berarti akun clasp yang aktif …"
      ],
      "durationMs": 524028
    },
    {
      "id": "md-20260928073734-a2i9k",
      "ts": "2026-09-28T07:37:34.354Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "prompt",
      "status": "completed",
      "prompt": "'/var/folders/dc/k5lxbylj5v1gjgnlmrwr8r4m0000gn/T/TemporaryItems/NSIRD_screencaptureui_wdbiu6/Screenshot 2026-09-28 at 15.32.49.png' kita gunakan akun google kominfoxith@gmail.com",
      "summary": "Baik, kita tetapkan akun proyeknya sebagai kominfoxith@gmail.com. Pemblokiran tadi terjadi karena login meminta gabungan scope project yang terlalu luas. Saya hentikan percobaan itu dan ulangi dengan scope standar resmi clasp; ini tidak mengubah source, Sheet, Drive, maupun Vercel—hanya autentikasi profil kominfo.Halaman login baru sudah dibuka dengan scope standar. Pilih kominfoxith@gmail.com pada halaman tersebut. Jika masih muncul “This app is blocked”, jangan lanjutkan—kirim tangkapan layar/beri tahu saya, dan saya akan pindah ke jalur aman tanpa OAuth clasp (migrasi dijalankan langsung dari Apps Script editor).Login berhasil sebagai kominfoxith@gmail.com. Saya lanjut memverifikasi bahw…",
      "changes": [
        "Saya hentikan percobaan itu dan ulangi dengan scope standar resmi clasp; ini tidak mengubah source, Sheet, Drive, maupun Vercel—hanya autentikasi profil kominfo.Halaman login baru sudah dibuka dengan scope standar.",
        "Saya tidak perlu meminta Imam mengubah setting sekarang: source sebelumnya sudah tersambung lewat akun editor lama, jadi saya akan push fungsi diagnostik lewat editor tersebut saja, lalu tetap menjalankan migrasi sebagai kominfoxith@gmail.…",
        "Jika ping juga gagal, jalur CLI execution memang tidak dapat dipakai dan migrasi harus dipicu langsung dari editor Apps Script—tanpa mengubah arsitektur backend.Masalahnya sudah ketemu: akun kominfoxith@gmail.com berhasil login dan memilik…"
      ],
      "files": [
        "/var/folders/dc/k5lxbylj5v1gjgnlmrwr8r4m0000gn/T/TemporaryItems/NSIRD_screencaptureui_wdbiu6/Screenshot 2026-09-28 at 15.32.49.png",
        "Secret/token tidak akan dicetak.Metadata",
        "kominfoxith@gmail.com"
      ],
      "verification": [
        "Error berasal dari runtime Apps Script sebelum migrasi."
      ],
      "avoid": [
        "Jika masih muncul “This app is blocked”, jangan lanjutkan—kirim tangkapan layar/beri tahu saya, dan saya akan pindah ke jalur aman tanpa OAuth clasp (migrasi dijalankan langsung dari Apps Script editor).Login berhasil sebagai kominfoxith@g…",
        "Saya lanjut memverifikasi bahwa akun ini memiliki akses ke project Apps Script, Spreadsheet, dan Drive; setelah itu saya jalankan konfigurasi serta migrasi idempoten dua kali untuk memastikan pengulangan tidak menggandakan tab atau field.A…",
        "Error berasal dari runtime Apps Script sebelum migrasi.",
        "Saya akan menambahkan diagnostik aman yang memeriksa PropertiesService, Spreadsheet, dan Drive secara terpisah tanpa menulis data pengguna, lalu push versi kecil ini dan jalankan melalui akun Kominfo untuk menemukan titik gagal yang tepat.…",
        "Dengan begitu akses Spreadsheet/Drive tetap memakai akun Kominfo.Diagnostik penuh masih gagal sebelum sempat mengembalikan hasil, jadi kemungkinan masalahnya berada pada Apps Script Execution API/deployment, bukan Sheet atau Drive.",
        "Jika ping juga gagal, jalur CLI execution memang tidak dapat dipakai dan migrasi harus dipicu langsung dari editor Apps Script—tanpa mengubah arsitektur backend.Masalahnya sudah ketemu: akun kominfoxith@gmail.com berhasil login dan memilik…",
        "Karena itu bahkan fungsi ping tanpa akses data ikut gagal."
      ],
      "durationMs": 263281
    },
    {
      "id": "md-20260928074530-i8t5ui",
      "ts": "2026-09-28T07:45:30.563Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "sudah aktif friday",
      "summary": "Saya lanjut dari titik terakhir: verifikasi dulu ping dan diagnostik resource memakai akun kominfoxith@gmail.com. Jika keduanya hijau, saya jalankan configureProject, ulangi setupProject untuk membuktikan idempotensi, lalu cek struktur Sheet—tetap tanpa deploy Vercel.API setting sudah aktif karena akun Kominfo kini dapat melakukan push, tetapi clasp run masih belum memiliki deployment tipe API Executable—itulah sebab fungsi ping tetap NOTFOUND. Saya akan memastikan siapa pemilik project Apps Script dan memeriksa manifest/deployment saat ini; setelah itu saya pilih jalur paling sempit, tanpa membuka akses publik atau menyentuh Vercel.Akun dan resource sudah benar; hambatan terakhir adalah cl…",
      "changes": [
        "Karena Imam meminta tidak mengubah deployment, jalur aman yang tersisa adalah satu konfigurasi manual di Apps Script: isi empat Script Properties, lalu jalankan setupProject.",
        "Setelah kedua eksekusi selesai tanpa error, balas “migrasi sudah dijalankan”."
      ],
      "files": [
        "kominfoxith@gmail.com",
        "drive.file",
        ".env.local"
      ],
      "verification": [
        "Jika keduanya hijau, saya jalankan configureProject, ulangi setupProject untuk membuktikan idempotensi, lalu cek struktur Sheet—tetap tanpa deploy Vercel.API setting sudah aktif karena akun Kominfo kini dapat melakukan push, tetapi clasp r…",
        "Saya akan memastikan siapa pemilik project Apps Script dan memeriksa manifest/deployment saat ini; setelah itu saya pilih jalur paling sempit, tanpa membuka akses publik atau menyentuh Vercel.Akun dan resource sudah benar; hambatan terakhi…",
        "Simpan, kembali ke Editor, pilih fungsi setupProject, lalu klik Run dan izinkan akses Google."
      ],
      "avoid": [
        "Setelah kedua eksekusi selesai tanpa error, balas “migrasi sudah dijalankan”."
      ],
      "durationMs": 197678
    },
    {
      "id": "md-20260928103321-w93hj8",
      "ts": "2026-09-28T10:33:21.209Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "migrasi sudah dijalankan",
      "summary": "Saya verifikasi hasilnya sekarang dari tiga sisi: log eksekusi Apps Script, metadata perubahan Spreadsheet, dan ekspor read-only workbook untuk memeriksa tab/header serta memastikan migrasi kedua tidak menggandakan kategori atau field. Setelah itu saya jalankan gate lokal terakhir; Vercel tetap tidak disentuh.Eksekusi manual kemungkinan berhasil, tetapi pemeriksaan pertama gagal karena token OAuth lokal sudah kedaluwarsa; itu bukan error migrasi. Saya akan menyegarkan token secara internal tanpa menampilkannya, lalu ulangi ekspor workbook read-only. Log Cloud tidak tersedia karena Apps Script masih memakai default GCP project, jadi bukti utama akan berasal dari struktur workbook aktual.Driv…",
      "changes": [
        "Saya verifikasi hasilnya sekarang dari tiga sisi: log eksekusi Apps Script, metadata perubahan Spreadsheet, dan ekspor read-only workbook untuk memeriksa tab/header serta memastikan migrasi kedua tidak menggandakan kategori atau field.",
        "Bukti yang tersedia: Spreadsheet diperbarui saat migrasi dan eksekusi manual selesai menurut hasil Imam.",
        "Deployment Apps Script tetap satu deployment lama @HEAD; Vercel tidak dideploy atau diubah."
      ],
      "files": [
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/README.md",
        "drive.file",
        "kominfoxith@gmail.com",
        "README.md"
      ],
      "verification": [
        "Saya lanjut dengan cleanup fungsi diagnostik sementara, dokumentasikan koneksi clasp/Script Properties, push source bersih, lalu jalankan seluruh test gate.Backend lokal sudah tersambung ke Apps Script menggunakan akun kominfoxith@gmail.co…",
        "Red: clasp run gagal karena project tidak memiliki deployment API Executable; migrasi kemudian dijalankan aman langsung dari Apps Script Editor.",
        "Verification: 25 tes unit/contract, 3 E2E API, lint, typecheck, Apps Script verifier, dan production build semuanya lulus.",
        "Audit Google Full-Stack 18/18, npm audit 0 vulnerability."
      ],
      "avoid": [
        "Setelah itu saya jalankan gate lokal terakhir; Vercel tetap tidak disentuh.Eksekusi manual kemungkinan berhasil, tetapi pemeriksaan pertama gagal karena token OAuth lokal sudah kedaluwarsa; itu bukan error migrasi.",
        "Red: clasp run gagal karena project tidak memiliki deployment API Executable; migrasi kemudian dijalankan aman langsung dari Apps Script Editor.",
        "Residual risk: isi setiap tab/header belum dapat saya baca otomatis karena scope OAuth tidak memberi akses ekspor workbook."
      ],
      "durationMs": 155440
    },
    {
      "id": "md-20260928103642-5bloed",
      "ts": "2026-09-28T10:36:42.698Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "jadi sisa apa friday?",
      "summary": "Backend dan migrasi dasar sudah selesai. Yang tersisa:",
      "changes": [
        "Backend dan migrasi dasar sudah selesai.",
        "Selesaikan ekspor"
      ],
      "files": [
        "kominfoxith@gmail.com",
        ".env.local"
      ],
      "verification": [
        "Ganti APPSSCRIPTURL di .env.local, kemudian lakukan health check dan signed API read ke Google Sheets."
      ],
      "avoid": [
        "Langkah paling tepat berikutnya: “Deploy Apps Script sebagai Web App dan uji koneksi backend, jangan deploy Vercel.”"
      ],
      "durationMs": 16125
    },
    {
      "id": "md-20260928104305-x6u6we",
      "ts": "2026-09-28T10:43:05.234Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "Deploy Apps Script sebagai Web App dan uji koneksi backend, jangan deploy Vercel friday",
      "summary": "Saya akan deploy Apps Script Web App saja, memakai akun pemilik kominfoxith@gmail.com, lalu memasukkan URL /exec ke .env.local dan menguji health serta signed request dari Next.js BFF. Saya tidak akan menjalankan perintah Vercel. Sebelum deploy, saya cek manifest/deployment lama dan pilihan akses minimum yang kompatibel dengan BFF HMAC.Saya lanjut di tahap deployment Web App: saya pastikan dulu konfigurasi aksesnya tepat untuk koneksi server-to-server, lalu membuat versi deployment baru, mengganti URL lokal secara aman, dan menguji health serta read melalui BFF. Vercel tetap tidak disentuh.Konfigurasi deploy yang diperlukan sudah jelas: Web App harus berjalan sebagai akun kominfoxith@gmail.…",
      "changes": [
        "Saya akan mengunci konfigurasi ini dengan tes, lalu menambahkan updater URL yang hanya mengubah endpoint dan tidak menyentuh secret lokal.Tes merah tadi menangkap dua celah nyata: manifest belum mendeklarasikan Web App dan belum ada cara a…",
        "Sekarang saya menguji jalur yang sebenarnya dipakai aplikasi: Next.js lokal → HMAC signature → Apps Script → Google Sheets, termasuk satu pembacaan aman tanpa mengubah data.Jalur penuh sudah lolos: /api/health dan pembacaan settings.public…",
        "Refactor: .env.local diperbarui tanpa mengubah secret dan tetap berizin 600.",
        "Ditambahkan updater endpoint aman serta validasi manifest."
      ],
      "files": [
        "manifest/deployment lama dan pilihan akses minimum yang kompatibel dengan BFF HMAC.Saya",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/.env.local",
        "kominfoxith@gmail.com",
        ".env.local",
        "settings.public"
      ],
      "verification": [
        "Saya masuk gate akhir sekarang—lint, typecheck, seluruh test, verifikasi Apps Script, build, dan E2E—tanpa perintah Vercel.Apps Script Web App sudah aktif dan backend lokal tersambung.",
        "npm run check: lint, typecheck, 28 test, Apps Script check, build, dan 3 E2E semuanya lulus"
      ],
      "avoid": [],
      "durationMs": 295476
    },
    {
      "id": "md-20260928232541-x2oljx",
      "ts": "2026-09-28T23:25:41.520Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "bagaimana cara saya menjalankannya, dan cara buat akun master",
      "summary": "Saya cek alur startup dan endpoint bootstrap yang sudah dibuat supaya langkahnya tepat, termasuk format username/password dan cara menyimpan cookie login. Tidak ada perubahan file atau deployment pada tahap ini.Backend dijalankan melalui Next.js lokal; URL Apps Script hanya sebagai API dan tidak perlu dibuka untuk mengelola data.",
      "changes": [
        "Tidak ada perubahan file atau deployment pada tahap ini.Backend dijalankan melalui Next.js lokal; URL Apps Script hanya sebagai API dan tidak perlu dibuka untuk mengelola data."
      ],
      "files": [
        "username/password dan cara menyimpan cookie login. Tidak ada perubahan file atau deployment pada tahap ini.Backend dijalankan melalui Next.js"
      ],
      "verification": [
        "Biarkan npm run dev tetap berjalan."
      ],
      "avoid": [],
      "durationMs": 63092
    },
    {
      "id": "md-20260929000950-k02m6r",
      "ts": "2026-09-29T00:09:50.545Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "template",
      "status": "completed",
      "prompt": "coba lohat hasil ini : imamhudzaifah@MacBook-Air-Imam SistemdatakaryawanKominfo % curl -b master.cookies http://localhost:3000/api/auth/session {\"ok\":true,\"data\":{\"actor\":{\"accountId\":\"dc8cb423-6ea4-497c-84d1-c3a2e1cc3fb0\",\"username\":\"masterkominfo\",\"displayName\":\"Admin Master Kominfo\",\"role\":\"MASTER_ADMIN\"}}}%",
      "summary": "Berhasil, Imam. Akun Admin Master sudah aktif dan login tervalidasi:",
      "changes": [],
      "files": [],
      "verification": [],
      "avoid": [
        "Tanda % di akhir hanya prompt Terminal zsh yang menempel karena respons JSON tidak memiliki baris baru—bukan error."
      ],
      "durationMs": 42484
    },
    {
      "id": "md-20260929225339-30r5yo",
      "ts": "2026-09-29T22:53:39.113Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "oke friday jadi kita akan buat UI nya, jadi pada folder image saya sudah desai sebelumnya di figma dan hanya masih beberapa bagian, jadi hanya ada halaman login, dashboard, contoh pengeditan data, dan ada logo kominfo, kegiatan, dan logo pemda, jadi saya mau kami menjadikan desain itu sebagai landasan desainnya, untuk bagian yang belum ada kamu sesuaikan dengan desain yang ada, dan buat lengkap semua agar user friendly dan juga tetap professional dan keren, tambahkan juga atau fokus juga dengan semua ukuran layar terutama mobile view,dan tambahkan jam realtime serta change thema mode, jangan kerjakan dulu kamu pahami kontesnya dulu dan persiapkan, nanti saya beri instruksi untuk kerjakan fr…",
      "summary": "Saya paham konteksnya, Imam. Kita belum mengerjakan sekarang—desain Figma yang sudah diekspor ke folder image akan menjadi sumber visual utama, bukan sekadar inspirasi bebas.",
      "changes": [],
      "files": [],
      "verification": [
        "Menurunkan design system dari referensi tersebut: warna, tipografi, spacing, bentuk komponen, ikon, tabel, formulir, dan pola navigasi.",
        "Saat Imam memberi instruksi “kerjakan UI-nya sekarang”, saya akan mulai dari audit folder image, menyusun peta halaman dan komponen, lalu mengimplementasikan serta menguji semuanya secara bertahap dengan TDD dan visual checking."
      ],
      "avoid": [
        "Melengkapi seluruh UI yang belum tersedia: portal publik, login tiap peran, dashboard Master/Admin, data PNS–PPPK–Non-PNS, akun, kolom dinamis, pengaturan, audit, detail, tambah/edit, upload foto, serta empty/loading/error states."
      ],
      "durationMs": 17832
    },
    {
      "id": "md-20260929235802-b0vdk",
      "ts": "2026-09-29T23:58:02.358Z",
      "root": "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo",
      "project": "SistemdatakaryawanKominfo",
      "type": "work-note",
      "source": "force-work",
      "status": "completed",
      "prompt": "kerjakan UI-nya sekarang friday, Gass buat saya terkesan",
      "summary": "Saya mulai implementasi penuh sekarang. Saya akan memakai Frontend Pro untuk menerjemahkan referensi Figma di folder image menjadi sistem desain dan UI operasional yang konsisten, lalu TDD Overdrive untuk menjaga login, sesi, role, dan koneksi backend tetap aman. Fase pertama: audit seluruh aset visual, struktur Next.js, kontrak API, serta pola test—setelah itu saya kunci alur utama dengan test sebelum membangun layar.Audit visual selesai. Bahasa desainnya kuat dan konsisten: navy Kominfo, panel putih-biru abu, kartu statistik sederhana, form bertahap, fotografi kegiatan sebagai identitas, dan logo instansi sebagai jangkar. Saya akan mempertahankan karakter itu, lalu memperluasnya menjadi a…",
      "changes": [
        "Fase pertama: audit seluruh aset visual, struktur Next.js, kontrak API, serta pola test—setelah itu saya kunci alur utama dengan test sebelum membangun layar.Audit visual selesai.",
        "Saya akan perbaiki jalur asetnya dengan mekanisme public asset yang stabil, sekaligus menutup dua aksi UI terakhir agar semuanya benar-benar berfungsi.Saya akan mengubah tiga bagian kecil tetapi penting: deklarasi aset Figma agar build sta…",
        "Saya tidak akan mematikan server Imam; test runner saya ubah memakai production server terisolasi di port 3210.API-level E2E 3/3 lolos; tiga UI browser test tertahan karena binary Chromium Playwright belum terpasang, bukan karena UI gagal.",
        "Untuk inspeksi visual lokal yang diminta Frontend Pro, saya memakai panduan browser automation dan akan memasang Chromium resmi Playwright, lalu menguji tampilan desktop serta mobile tanpa mengganggu server port 3000 milik Imam.Chromium se…",
        "Saya akan memeriksa landing/login pada desktop dan mobile; dashboard sudah diverifikasi lewat browser test dengan respons backend representatif dan pengecekan overflow.Audit visual menunjukkan landing dan login sudah matang setelah animasi…",
        "Saya tinggal mengambil satu audit dashboard terisolasi untuk mengecek kepadatan informasi, sidebar, tabel ringkasan, dan keseimbangan desktop.Screenshot dashboard pada dev server lama tertahan di layar sinkronisasi—server port 3000 ternyat…",
        "Saya menutup preview sementara dan sekarang menjalankan satu full release gate terakhir dari lint sampai browser E2E.UI lengkap sudah selesai, Imam—berdasarkan desain Figma dengan karakter visual Kominfo/Pemda yang konsisten.",
        "Tidak ada deployment Vercel maupun perubahan deployment Apps Script."
      ],
      "files": [
        "lama/konfirmasi baru lalu mengakhiri sesi secara aman. Setelah ini saya jalankan ulang seluruh gate.Gate",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/src/app/globals.css",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/src/components/dashboard/dashboard-app.tsx",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/src/components/dashboard/dashboard-panels.tsx",
        "/Users/imamhudzaifah/Documents/Work/Magang/SistemdatakaryawanKominfo/src/components/dashboard/dashboard-dialogs.tsx",
        "globals.css",
        "dashboard-app.tsx",
        "dashboard-panels.tsx",
        "dashboard-dialogs.tsx"
      ],
      "verification": [
        "Fase pertama: audit seluruh aset visual, struktur Next.js, kontrak API, serta pola test—setelah itu saya kunci alur utama dengan test sebelum membangun layar.Audit visual selesai.",
        "Selanjutnya saya petakan kontrak backend dan menulis test untuk routing login, session guard, theme persistence, serta respons mobile sebelum implementasi komponen.Saya sudah memetakan permukaan produk: publik, login tiga area, dashboard r…",
        "Sebelum menyentuh UI, saya menambahkan test model tampilan untuk statistik, pencarian, role-based navigation, dan pemilihan tema—ini akan menjadi pagar regresi saat layar mulai terhubung ke data nyata.Model UI sudah hijau.",
        "Saya masuk ke fase quality gate sekarang: typecheck dan lint dulu, lalu saya rapikan fungsi yang belum boleh terasa “pajangan” seperti ekspor serta ganti password, setelah itu baru uji desktop/mobile secara nyata.TypeScript menangkap satu …",
        "Saya akan perbaiki jalur asetnya dengan mekanisme public asset yang stabil, sekaligus menutup dua aksi UI terakhir agar semuanya benar-benar berfungsi.Saya akan mengubah tiga bagian kecil tetapi penting: deklarasi aset Figma agar build sta…",
        "Saya sedang menggantinya dengan pola lifecycle modern, sekaligus mempertahankan jam real-time, theme persistence, modal portal, dan preview foto tanpa melemahkan lint.Typecheck dan lint sekarang bersih tanpa warning.",
        "Saya lanjut mengunci pengalaman pengguna lewat automated browser tests: halaman publik/login, dashboard dengan respons backend terkontrol, navigasi, theme toggle, serta pengecekan tidak ada horizontal overflow pada mobile.Unit tests hijau …",
        "Production build menemukan masalah khusus Turbopack: ekstensi gambar .JPG kapital tidak didukung sebagai static module."
      ],
      "avoid": [
        "Saya masuk ke fase quality gate sekarang: typecheck dan lint dulu, lalu saya rapikan fungsi yang belum boleh terasa “pajangan” seperti ekspor serta ganti password, setelah itu baru uji desktop/mobile secara nyata.TypeScript menangkap satu …",
        "Setelah ini saya jalankan ulang seluruh gate.Gate kedua sudah lebih dalam: tidak ada error TypeScript, tetapi aturan React 19/Next 16 menolak beberapa pola effect lama yang berpotensi memicu render berantai.",
        "Saya tidak akan mematikan server Imam; test runner saya ubah memakai production server terisolasi di port 3210.API-level E2E 3/3 lolos; tiga UI browser test tertahan karena binary Chromium Playwright belum terpasang, bukan karena UI gagal.",
        "Satu kegagalan justru menunjukkan nama pegawai muncul di dua kolom yang sah—identitas utama dan kolom dinamis—sehingga assertion test terlalu umum."
      ],
      "durationMs": 1785998
    }
  ],
  "updatedAt": "2026-09-30T00:07:15.525Z",
  "lastFlush": {
    "at": "2026-09-30T00:07:15.525Z",
    "reason": "shutdown:ctrl-c",
    "count": 13
  }
}
```
<!-- FRIDAY:PROJECT-RESOURCE:END -->
