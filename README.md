# OHD Museum - Headless REST API Layer

Sistem Backend REST API Layer murni (Pure Headless API) untuk platform digital **Museum Oei Hong Djien (OHD)** berbasis **Next.js App Router**, **TypeScript**, dan **PostgreSQL Terkelola (Render.com)**.

Proyek ini dibangun berdasarkan dokumen proposal DiPStrategy, panduan desain antarmuka Figma OHD Museum, serta mencakup seluruh kebutuhan operasional **14 Modul CMS enterprise**.

---

## Arsitektur Sistem

```text
+-------------------------------------------------------+
|                 APLIKASI KLIEN EKSTERNAL              |
|   +-----------------------+   +-------------------+   |
|   |  Public Frontend Web  |   |  CMS Admin Panel  |   |
|   | (Next.js / React UI)  |   | (Curator / Staff) |   |
|   +-----------+-----------+   +---------+---------+   |
+---------------|-------------------------|-------------+
                |                         |
                |  REST API (JSON only)   |
                v                         v
+-------------------------------------------------------+
|        OHD MUSEUM HEADLESS API (Repository ini)       |
|            Next.js App Router (/api/v1/...)           |
|                                                       |
|  * JWT Auth & Role Based Access Control (RBAC)        |
|  * Audit Trail Logger (Append-Only)                   |
|  * Trigram Full-Text Search Engine                    |
|  * Standardized API Response & Input Validation       |
+---------------------------+---------------------------+
                            |
                 pg pool (SSL connection)
                            v
+-------------------------------------------------------+
|            DATABASE POSTGRESQL (Render.com)           |
|             20 Tabel Berelasi (3NF Schema)            |
+-------------------------------------------------------+
```

---

## 14 Modul CMS & Katalog Endpoint API

Semua endpoint Route Handlers berada di bawah prefix `/api/v1/` dan mengembalikan respons berformat JSON seragam.

### 1. Modul Kesehatan & Status Sistem
* `GET /api/v1/health`: Memeriksa latensi koneksi dan kesehatan live database PostgreSQL di Render.com.

### 2. Modul Autentikasi (Authentication Module)
* `POST /api/v1/auth/login`: Masuk sistem dengan email dan kata sandi, mengembalikan token JWT bertipe Bearer.
* `GET /api/v1/auth/me`: Mengambil data profil staf yang sedang aktif dan daftar hak akses (permissions).
* `POST /api/v1/auth/logout`: Mencatat jejak audit sesi keluar.

### 3. Modul Hak Akses & Pengguna (Authorization & User Management)
* `GET /api/v1/roles`: Melihat daftar peran (Super Admin, Curator, Editor, Receptionist) beserta pemetaan 51 hak akses.
* `GET /api/v1/users`: Daftar staf pengguna CMS dengan filter role dan pagination.
* `POST /api/v1/users`: Membuat akun staf baru dengan enkripsi kata sandi Bcrypt.
* `GET /api/v1/users/[id]`: Detail data akun pengguna.
* `PUT /api/v1/users/[id]`: Memperbarui data pengguna, peran, atau kata sandi.
* `DELETE /api/v1/users/[id]`: Menghapus akun pengguna (dilindungi proteksi anti-hapus diri sendiri).

### 4. Modul Dashboard (Dashboard Module)
* `GET /api/v1/dashboard/stats`: Menampilkan ringkasan metrik inventaris karya seni, pameran aktif, tiket reservasi, pesan masuk, dan aktivitas audit log terbaru.

### 5. Modul Taksonomi (Category Management)
* `GET /api/v1/categories`: Menampilkan taksonomi era seni, medium karya, topik artikel, dan tipe dokumen.
* `POST /api/v1/categories`: Menambahkan kategori atau subkategori baru.

### 6. Modul Koleksi & Maestro Seni (Artworks & Artists)
* `GET /api/v1/artists`: Daftar maestro seni rupa (Affandi, Hendra Gunawan, dll.) dengan filter marquee beranda.
* `POST /api/v1/artists`: Menambahkan profil maestro baru.
* `GET /api/v1/artists/[id]`: Detail maestro beserta daftar karya seni ciptaannya.
* `PUT /api/v1/artists/[id]`: Memperbarui data profil seniman.
* `DELETE /api/v1/artists/[id]`: Menghapus data seniman.
* `GET /api/v1/artworks`: Eksplorasi 2.000+ karya seni dengan filter medium, era, karya pilihan (featured), dan pagination.
* `POST /api/v1/artworks`: Menambahkan karya seni baru ke inventaris.
* `GET /api/v1/artworks/[id]`: Detail kuratorial karya seni beserta riwayat pameran terkait.
* `PUT /api/v1/artworks/[id]`: Memperbarui spesifikasi dan informasi karya seni.
* `DELETE /api/v1/artworks/[id]`: Menghapus karya seni dari inventaris.

### 7. Modul Kalender Pameran (Exhibition Calendar)
* `GET /api/v1/exhibitions`: Agenda pameran dengan filter status (current, upcoming, past).
* `POST /api/v1/exhibitions`: Mendaftarkan pameran baru beserta kurator dan daftar karya seni terkait.
* `GET /api/v1/exhibitions/[id]`: Detail pameran dan karya yang dipamerkan.
* `PUT /api/v1/exhibitions/[id]`: Memperbarui data agenda pameran.
* `DELETE /api/v1/exhibitions/[id]`: Menghapus pameran.

### 8. Modul Publikasi Artikel & Buku (Articles & Books)
* `GET /api/v1/articles`: Artikel kuratorial dan warta museum (publik hanya melihat status published).
* `POST /api/v1/articles`: Membuat draf artikel baru.
* `GET /api/v1/articles/[id]`: Detail artikel kuratorial berdasarkan ID atau slug URL.
* `PUT /api/v1/articles/[id]`: Memperbarui konten artikel atau mengubah status penerbitan.
* `DELETE /api/v1/articles/[id]`: Menghapus artikel.
* `GET /api/v1/books`: Katalog publikasi buku OHD Museum.
* `POST /api/v1/books`: Menambahkan katalog buku baru (ISBN, sinopsis, sampul, tautan WhatsApp).
* `GET /api/v1/books/[id]`: Detail katalog buku.
* `PUT /api/v1/books/[id]`: Memperbarui data buku.
* `DELETE /api/v1/books/[id]`: Menghapus buku dari katalog.

### 9. Modul Spanduk Beranda (Banner Management)
* `GET /api/v1/banners`: Banner hero beranda untuk tampilan desktop dan mobile dengan pengurutan otomatis.
* `POST /api/v1/banners`: Menambahkan banner promosi baru.
* `PUT /api/v1/banners/[id]`: Memperbarui tampilan banner.
* `DELETE /api/v1/banners/[id]`: Menghapus banner.

### 10. Modul Navigasi Menu (Menu Management)
* `GET /api/v1/menus`: Mengambil struktur pohon navigasi bertingkat (Header, Mega Menu Publikasi, Footer).

### 11. Modul Halaman Naratif (Pages Management)
* `GET /api/v1/pages`: Daftar halaman statis naratif.
* `GET /api/v1/pages/[slug]`: Mengambil konten halaman (About Museum, Profil Dr. OHD, Panduan Kunjungan) berdasarkan slug.
* `POST /api/v1/pages`: Membuat halaman statis baru.
* `PUT /api/v1/pages/[slug]`: Memperbarui narasi dan metadata SEO halaman.
* `DELETE /api/v1/pages/[slug]`: Menghapus halaman.

### 12. Modul Media & Berkas (Document Management)
* `GET /api/v1/documents`: Daftar media dokumen PDF katalog, press kit, dan brosur panduan.
* `POST /api/v1/documents`: Mendaftarkan tautan berkas Cloudinary dan metadata ukuran file.

### 13. Modul Reservasi & Kontak (Ticketing & Contact Management)
* `POST /api/v1/reservations`: Formulir publik pemesanan tiket dengan penerbitan kode booking unik otomatis (OHD-YYYYMM-XXXX).
* `GET /api/v1/reservations`: Daftar reservasi pengunjung untuk pengelola front desk/resepsionis.
* `PATCH /api/v1/reservations/[id]`: Konfirmasi kehadiran atau pembaruan status reservasi (pending, confirmed, completed, cancelled).
* `POST /api/v1/contact`: Pengiriman pertanyaan atau pesan dari formulir kontak publik.
* `GET /api/v1/contact`: Daftar pesan masuk di dashboard pengelola.
* `PATCH /api/v1/contact/[id]`: Memperbarui status pesan (unread, replied, archived) dan catatan internal staf.

### 14. Modul Mesin Pencari & Konfigurasi Sistem (Search & System Settings)
* `GET /api/v1/search?q=kata_kunci`: Mesin pencari terpadu lintas karya seni, maestro, pameran, artikel, dan buku menggunakan indeks Trigram PostgreSQL.
* `GET /api/v1/settings`: Konfigurasi global museum (jam operasional, tarif tiket, kontak WhatsApp resmi, media sosial, dan SEO).
* `PUT /api/v1/settings`: Memperbarui nilai konfigurasi sistem (khusus Super Admin).
* `GET /api/v1/audit-logs`: Buku jejak riwayat audit aktivitas staf CMS (append-only).

---

## Standar Format JSON Response

### Sukses:
```json
{
  "success": true,
  "message": "Koleksi karya seni berhasil dimuat",
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### Kesalahan (Error):
```json
{
  "success": false,
  "message": "Akses ditolak: izin tidak memadai",
  "error": "FORBIDDEN"
}
```

---

## Menjalankan Proyek di Komputer Lokal

### 1. Salin Environment
Salin berkas konfigurasi lingkungan dari template:
```bash
cp .env.example .env
```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Pengujian Tipe & Integritas Basis Data
```bash
npm run typecheck
npm run test:api
```

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Server backend akan aktif di `http://localhost:3001`. Anda dapat membuka peramban untuk melihat katalog endpoint di halaman root atau langsung mengakses endpoint `/api/v1/health`.

### 5. Kompilasi untuk Produksi
```bash
npm run build
npm run start
```
