# OHD Museum PostgreSQL Database

Struktur basis data relasional PostgreSQL untuk platform **OHD Museum (Oei Hong Djien)** yang telah dinormalisasi ke Third Normal Form (3NF) dan mendukung seluruh kebutuhan 14 Modul CMS serta antarmuka website publik (Figma).

## Isi Berkas

1. `schema.sql`: Berisi definisi DDL lengkap untuk 20 tabel, ekstensi UUID & Trigram, trigger otomatis `updated_at`, batasan integritas data (check constraints), serta indeks performa dan full-text search.
2. `seed.sql`: Berisi data inisial sistem, mencakup:
   - 4 Role default (`super_admin`, `curator`, `editor`, `receptionist`).
   - Granular permissions untuk seluruh 14 modul CMS.
   - Akun inisial Super Admin (`admin@ohdmuseum.com`).
   - Taksonomi kategori default (Era seni, medium karya, topik artikel, tipe dokumen).
   - Konfigurasi sistem default (profil museum, jadwal operasional, tarif tiket, integrasi WhatsApp Business, SEO).
   - Struktur navigasi menu default.
3. `verify.js`: Skrip verifikasi integritas dependensi relasi foreign key dan validasi standar kode.

## Cara Menjalankan di PostgreSQL / Supabase

### Opsi A: Lewat Supabase Dashboard / PgAdmin
1. Buka **SQL Editor** pada dashboard Supabase atau PgAdmin Anda.
2. Salin dan jalankan seluruh isi berkas `schema.sql`.
3. Setelah tabel berhasil dibuat, salin dan jalankan isi berkas `seed.sql`.

### Opsi B: Lewat Terminal (psql)
```bash
# 1. Jalankan pembuatan schema
psql -h <HOST> -U <USER> -d <DB_NAME> -f database/schema.sql

# 2. Jalankan pengisian data awal (seed)
psql -h <HOST> -U <USER> -d <DB_NAME> -f database/seed.sql
```

### Opsi C: Menggunakan Docker Compose (Lokal)
Jika Anda ingin menjalankan PostgreSQL secara instan di komputer lokal, skema dan seed dapat dimuat secara otomatis saat container pertama kali menyala.
