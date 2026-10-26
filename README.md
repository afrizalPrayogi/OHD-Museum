# OHD Museum - Backend & Database Architecture

Sistem Backend dan Basis Data untuk platform digital **Museum Oei Hong Djien (OHD)** berbasis PostgreSQL yang mendukung arsitektur Decoupled/Headless CMS, terintegrasi dengan 14 Modul CMS dan antarmuka desain Figma.

## 🛠️ Tech Stack Architecture
- **Frontend & Presentation:** Next.js (React, Tailwind CSS, TypeScript)
- **Headless CMS Engine:** Strapi CMS
- **Database:** PostgreSQL / Supabase
- **Media & Assets Storage:** Cloudinary
- **Visitor Engagement:** WhatsApp Business API

---

## 🏛️ 14 Core CMS Modules
1. **Authentication Module:** Autentikasi staf, JWT & session management.
2. **Authorization Module (RBAC):** Hak akses role-based (Super Admin, Curator, Editor, Receptionist) dan granular permissions.
3. **System Configuration Module:** Pengaturan operasional museum (jam buka, tarif, kontak resmi, SEO).
4. **Audit Trail Module:** Riwayat pencatatan aktivitas staf (append-only) untuk integritas arsip seni.
5. **Dashboard Module:** Agregasi statistik koleksi seni, agenda pameran, reservasi tiket, dan pesan masuk.
6. **Search Module:** Pencarian terindeks dan full-text search PostgreSQL (`pg_trgm`).
7. **Localization Module (i18n):** Dukungan multi-bahasa (Bahasa Indonesia `id` & English `en`).
8. **Menu Management Module:** Struktur hierarkis navigasi header navbar, mega menu, dan footer.
9. **Pages Management Module:** Halaman naratif statis (Sejarah OHD Museum, Profil Dr. OHD, Panduan Kunjungan).
10. **Category Management Module:** Taksonomi terpusat untuk klasifikasi karya seni, pameran, artikel, dan dokumen.
11. **Article Management Module:** Esai kuratorial, ulasan pameran, dan rilis berita seni.
12. **Banner Management Module:** Hero slider dinamis untuk tampilan desktop dan mobile.
13. **Document Management Module:** Repositori berkas digital publik (katalog pameran, buku panduan, press kit).
14. **Contact Management Module:** Penanganan formulir pesan pengunjung dan pemesanan reservasi kunjungan fisik.

---

## 📊 Database Schema & ERD
Skema basis data telah dinormalisasi hingga **Third Normal Form (3NF)** dengan model dokumen hybrid (JSONB) untuk konten rich text.

Terdapat 20 tabel inti:
- **RBAC & Auth:** `roles`, `permissions`, `role_permissions`, `users`, `audit_logs`
- **Koleksi & Pameran:** `categories`, `artists`, `artworks`, `exhibitions`, `exhibition_artworks`
- **Publikasi & Dokumen:** `articles`, `books`, `documents`
- **Tampilan CMS:** `menus`, `menu_items`, `pages`, `banners`
- **Interaksi & Pengaturan:** `reservations`, `contact_inquiries`, `system_settings`

---

## 🚀 Panduan Eksekusi Database
Seluruh skrip SQL siap dijalankan di PostgreSQL, Supabase, pgAdmin, atau Adminer:
- `database/schema.sql`: Definisi struktur DDL, indeks trigram, trigger `updated_at`, dan foreign key.
- `database/seed.sql`: Data awal (4 roles, default permissions, Super Admin, taksonomi awal, dan profil museum).
- `database/full_database.sql`: Gabungan skema dan seed untuk satu kali eksekusi instan.
