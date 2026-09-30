# Kontrak Backend Sistem Data Karyawan Kominfo Parepare

Semua request browser dikirim ke Next.js pada origin yang sama. Browser tidak boleh memanggil Apps Script secara langsung.

## Envelope browser

`POST /api/backend` menerima:

```json
{ "action": "employees.list", "payload": { "categoryId": "..." } }
```

Mutation wajib menyertakan header `x-csrf-token`. Session disimpan dalam cookie `HttpOnly`, `SameSite=Strict`, dan `Secure` pada production.

## Akses

- Publik: `health`, konfigurasi publik, kategori/field/data publik ketika mode `PUBLIC`.
- Portal: baca kategori, field, pegawai, dan foto ketika mode tidak `CLOSED`.
- Admin Kominfo: CRUD kategori, field dinamis, pegawai, foto, akun Portal, pengaturan, audit, dan ekspor snapshot.
- Admin Master: seluruh akses Admin Kominfo serta CRUD dan pemulihan akun Admin Kominfo.

## Konkurensi dan penghapusan

Update dan delete mengirim `expectedVersion`. Ketidaksesuaian menghasilkan `VERSION_CONFLICT`. Delete bersifat soft-delete dan dapat dipulihkan.

## Kredensial

Login menggunakan hash `scrypt`. Salinan yang dapat dilihat sesuai kebutuhan pengembangan disimpan sebagai AES-256-GCM dan hanya didekripsi oleh BFF. Apps Script dan Sheets tidak menyimpan password plaintext.

## Action utama

- `settings.get`, `settings.update`
- `categories.list|create|update|delete|restore`
- `fields.list|create|update|delete|restore`
- `employees.list|get|create|update|delete|restore`
- `files.upload|get|delete`
- `accounts.listActiveAdmins|listAdmins|listPortal`
- `accounts.createAdmin|updateAdmin|deleteAdmin|restoreAdmin|resetAdminPassword|revealAdminCredential`
- `accounts.createPortal|updatePortal|deletePortal|restorePortal|resetPortalPassword|revealPortalCredential`
- `accounts.changeOwnPassword`, `audit.list`, `export.snapshot`
