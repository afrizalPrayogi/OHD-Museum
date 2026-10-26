-- =============================================================================
-- OHD MUSEUM INITIAL SEED DATA
-- Default Roles, Permissions, Categories, Settings, and Admin User
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SEED ROLES
-- -----------------------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'super_admin', 'Full access to all CMS modules, configurations, and user management'),
    ('22222222-2222-2222-2222-222222222222', 'curator', 'Manage artworks, artists, exhibitions, publications, and categories'),
    ('33333333-3333-3333-3333-333333333333', 'editor', 'Manage articles, banners, documents, and static pages'),
    ('44444444-4444-4444-4444-444444444444', 'receptionist', 'Manage reservations, visitor attendance, and contact inquiries')
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. SEED PERMISSIONS (Across All 14 Modules)
-- -----------------------------------------------------------------------------
INSERT INTO permissions (code, module, description) VALUES
    -- Users & Auth
    ('users:read', 'Authentication', 'View staff users'),
    ('users:create', 'Authentication', 'Create new staff user'),
    ('users:update', 'Authentication', 'Update existing staff user'),
    ('users:delete', 'Authentication', 'Delete staff user'),

    -- Roles & RBAC
    ('roles:read', 'Authorization', 'View roles and permissions'),
    ('roles:update', 'Authorization', 'Update role assignments'),

    -- System Configuration
    ('settings:read', 'System Configuration', 'View global museum settings'),
    ('settings:update', 'System Configuration', 'Update global museum settings'),

    -- Audit Trail
    ('audit:read', 'Audit Trail', 'View system audit activity logs'),

    -- Category Management
    ('categories:read', 'Category Management', 'View categories'),
    ('categories:create', 'Category Management', 'Create new category'),
    ('categories:update', 'Category Management', 'Update category'),
    ('categories:delete', 'Category Management', 'Delete category'),

    -- Artists & Maestro
    ('artists:read', 'Collections & Maestro', 'View artist profiles'),
    ('artists:create', 'Collections & Maestro', 'Create new artist profile'),
    ('artists:update', 'Collections & Maestro', 'Update artist profile'),
    ('artists:delete', 'Collections & Maestro', 'Delete artist profile'),

    -- Artworks
    ('artworks:read', 'Collections & Exhibits', 'View artworks inventory'),
    ('artworks:create', 'Collections & Exhibits', 'Create artwork record'),
    ('artworks:update', 'Collections & Exhibits', 'Update artwork record'),
    ('artworks:delete', 'Collections & Exhibits', 'Delete artwork record'),

    -- Exhibitions
    ('exhibitions:read', 'Exhibition Calendar', 'View exhibitions'),
    ('exhibitions:create', 'Exhibition Calendar', 'Create new exhibition'),
    ('exhibitions:update', 'Exhibition Calendar', 'Update exhibition'),
    ('exhibitions:delete', 'Exhibition Calendar', 'Delete exhibition'),

    -- Articles
    ('articles:read', 'Article Management', 'View articles'),
    ('articles:create', 'Article Management', 'Create new article'),
    ('articles:update', 'Article Management', 'Update article'),
    ('articles:delete', 'Article Management', 'Delete article'),
    ('articles:publish', 'Article Management', 'Publish or archive article'),

    -- Books
    ('books:read', 'Publication & Books', 'View publication books'),
    ('books:create', 'Publication & Books', 'Create publication book'),
    ('books:update', 'Publication & Books', 'Update publication book'),
    ('books:delete', 'Publication & Books', 'Delete publication book'),

    -- Documents
    ('documents:read', 'Document Management', 'View media and documents'),
    ('documents:create', 'Document Management', 'Upload document or media asset'),
    ('documents:update', 'Document Management', 'Update document metadata'),
    ('documents:delete', 'Document Management', 'Delete document file'),

    -- Menus
    ('menus:read', 'Menu Management', 'View navigation menus'),
    ('menus:update', 'Menu Management', 'Update navigation menus'),

    -- Pages
    ('pages:read', 'Pages Management', 'View static pages'),
    ('pages:update', 'Pages Management', 'Update static pages'),

    -- Banners
    ('banners:read', 'Banner Management', 'View hero banners'),
    ('banners:create', 'Banner Management', 'Create new hero banner'),
    ('banners:update', 'Banner Management', 'Update hero banner'),
    ('banners:delete', 'Banner Management', 'Delete hero banner'),

    -- Reservations & Ticketing
    ('reservations:read', 'Ticketing & Visit', 'View visitor reservations'),
    ('reservations:update', 'Ticketing & Visit', 'Update reservation details'),
    ('reservations:confirm', 'Ticketing & Visit', 'Confirm visitor attendance and ticket'),

    -- Contact Inquiries
    ('contacts:read', 'Contact Management', 'View incoming contact messages'),
    ('contacts:update', 'Contact Management', 'Update contact message status')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. ASSIGN PERMISSIONS TO ROLES
-- -----------------------------------------------------------------------------

-- Super Admin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM permissions
ON CONFLICT DO NOTHING;

-- Curator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM permissions
WHERE module IN ('Collections & Maestro', 'Collections & Exhibits', 'Exhibition Calendar', 'Publication & Books', 'Category Management')
   OR code IN ('articles:read', 'articles:create', 'articles:update', 'articles:publish', 'documents:read', 'documents:create')
ON CONFLICT DO NOTHING;

-- Editor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM permissions
WHERE module IN ('Article Management', 'Banner Management', 'Document Management', 'Pages Management', 'Menu Management')
ON CONFLICT DO NOTHING;

-- Receptionist permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM permissions
WHERE module IN ('Ticketing & Visit', 'Contact Management')
   OR code IN ('settings:read')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. INITIAL SUPER ADMIN USER (Password: Admin@OHD2025!)
-- -----------------------------------------------------------------------------
-- Note: bcrypt hash for 'Admin@OHD2025!'
INSERT INTO users (
    id,
    role_id,
    full_name,
    email,
    password_hash,
    phone,
    is_active
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Super Admin OHD',
    'admin@ohdmuseum.com',
    '$2b$10$4iRsM17U3We/Rgc5Vhrw9uPgGWr6qFmdAcS8EZCa4s5Y/IM084l8y',
    '+6281234567890',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. DEFAULT CATEGORIES
-- -----------------------------------------------------------------------------
-- Artwork Era Categories
INSERT INTO categories (id, parent_id, type, name, slug, description) VALUES
    ('c0000001-0000-0000-0000-000000000001', NULL, 'artwork_era', 'Mooi Indie (Hindia Molek)', 'mooi-indie', 'Periode seni lukis pemandangan dan romantisme Hindia Belanda'),
    ('c0000002-0000-0000-0000-000000000002', NULL, 'artwork_era', 'Persagi & Masa Revolusi', 'persagi-revolusi', 'Era semangat nasionalisme dan realisme sosial Indonesia (1938-1950)'),
    ('c0000003-0000-0000-0000-000000000003', NULL, 'artwork_era', 'Seni Modern Indonesia', 'seni-modern-indonesia', 'Periode kemerdekaan dan eksplorasi ekspresionisme, kubisme, dan abstraksi'),
    ('c0000004-0000-0000-0000-000000000004', NULL, 'artwork_era', 'Seni Kontemporer', 'seni-kontemporer', 'Eksplorasi seni rupa Indonesia era 1980-an hingga saat ini')
ON CONFLICT (slug) DO NOTHING;

-- Artwork Medium Categories
INSERT INTO categories (id, parent_id, type, name, slug, description) VALUES
    ('c0000011-0000-0000-0000-000000000011', NULL, 'artwork_medium', 'Lukisan (Painting)', 'lukisan', 'Karya seni dua dimensi cat minyak, akrilik, dan mixed media di atas kanvas'),
    ('c0000012-0000-0000-0000-000000000012', NULL, 'artwork_medium', 'Patung & Skulptur', 'patung-skulptur', 'Karya seni rupa tiga dimensi berbahan perunggu, kayu, batu, dan logam'),
    ('c0000013-0000-0000-0000-000000000013', NULL, 'artwork_medium', 'Seni Kertas & Sketsa', 'sketsa-kertas', 'Sketsa, litografi, drawing, dan karya tinta di atas kertas'),
    ('c0000014-0000-0000-0000-000000000014', NULL, 'artwork_medium', 'Instalasi & Media Baru', 'seni-instalasi', 'Karya seni instalasi ruang dan seni berbasis media kontemporer')
ON CONFLICT (slug) DO NOTHING;

-- Article Topic Categories
INSERT INTO categories (id, parent_id, type, name, slug, description) VALUES
    ('c0000021-0000-0000-0000-000000000021', NULL, 'article_topic', 'Esai Kuratorial', 'esai-kuratorial', 'Catatan dan telaah kurator terhadap karya dan pameran'),
    ('c0000022-0000-0000-0000-000000000022', NULL, 'article_topic', 'Warta Museum', 'warta-museum', 'Kabar berita, agenda kunjungan, dan liputan kegiatan di OHD Museum'),
    ('c0000023-0000-0000-0000-000000000023', NULL, 'article_topic', 'Profil Tokoh Maestro', 'profil-tokoh-maestro', 'Ulasan mendalam mengenai biografi dan sumbangsih maestro seni rupa')
ON CONFLICT (slug) DO NOTHING;

-- Document Type Categories
INSERT INTO categories (id, parent_id, type, name, slug, description) VALUES
    ('c0000031-0000-0000-0000-000000000031', NULL, 'document_type', 'Brosur & Panduan Kunjungan', 'brosur-panduan', 'Brosur digital dan informasi panduan bagi wisatawan'),
    ('c0000032-0000-0000-0000-000000000032', NULL, 'document_type', 'Katalog Pameran', 'katalog-pameran', 'Arsip digital katalog pameran OHD Museum'),
    ('c0000033-0000-0000-0000-000000000033', NULL, 'document_type', 'Press Kit & Media Release', 'press-kit', 'Materi informasi bagi jurnalis dan rekan media')
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. DEFAULT SYSTEM CONFIGURATION
-- -----------------------------------------------------------------------------
INSERT INTO system_settings (key, value, group_name, description) VALUES
    ('museum_profile', '{
        "name": "Oei Hong Djien (OHD) Museum",
        "tagline": "The Home of Modern and Contemporary Indonesian Art",
        "address": "Jl. Jenggolo No.14, Kemirirejo, Kec. Magelang Tengah, Kota Magelang, Jawa Tengah 56122",
        "city": "Magelang",
        "province": "Jawa Tengah",
        "country": "Indonesia",
        "postal_code": "56122",
        "phone": "+62 293 363420",
        "email": "info@ohdmuseum.com",
        "maps_url": "https://maps.google.com/?q=OHD+Museum+Magelang"
    }'::jsonb, 'general', 'Identitas dan profil resmi OHD Museum'),

    ('operational_hours', '{
        "days_open": "Senin, Rabu - Minggu",
        "day_closed": "Selasa",
        "morning_session": "10:00 - 13:00 WIB",
        "afternoon_session": "14:00 - 17:00 WIB",
        "note": "Kunjungan disarankan melakukan reservasi terlebih dahulu."
    }'::jsonb, 'ticketing', 'Jadwal operasional dan sesi kunjungan museum'),

    ('ticket_pricing', '{
        "domestic_adult": 50000,
        "domestic_student": 25000,
        "international_visitor": 100000,
        "tour_guide_service": 150000,
        "currency": "IDR"
    }'::jsonb, 'ticketing', 'Struktur tarif tiket masuk resmi museum'),

    ('whatsapp_business', '{
        "official_number": "+6281234567890",
        "display_name": "OHD Museum Guest Service",
        "welcome_template": "Halo! Terima kasih telah menghubungi OHD Museum Magelang. Ada yang bisa kami bantu seputar reservasi tiket atau koleksi seni?",
        "reservation_template": "Halo OHD Museum, saya ingin konfirmasi reservasi tiket dengan kode: {booking_code} atas nama {full_name}."
    }'::jsonb, 'contact', 'Konfigurasi integrasi WhatsApp Business'),

    ('social_media', '{
        "instagram": "https://instagram.com/ohdmuseum",
        "youtube": "https://youtube.com/@ohdmuseum",
        "facebook": "https://facebook.com/ohdmuseum"
    }'::jsonb, 'contact', 'Tautan akun media sosial resmi OHD Museum'),

    ('seo_defaults', '{
        "site_title": "OHD Museum - Pusat Warisan Seni Rupa Modern & Kontemporer Indonesia",
        "site_description": "Menampilkan lebih dari 2.000 karya seni rupa maestro legendaris Indonesia koleksi Dr. Oei Hong Djien di Magelang.",
        "site_keywords": ["OHD Museum", "Museum Magelang", "Seni Rupa Indonesia", "Affandi", "Hendra Gunawan", "Dr Oei Hong Djien"],
        "og_image": "https://res.cloudinary.com/ohdmuseum/image/upload/v1/meta/og-image-ohd.jpg"
    }'::jsonb, 'seo', 'Pengaturan metadata default SEO dan OpenGraph')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. DEFAULT MENUS (Navigation)
-- -----------------------------------------------------------------------------
INSERT INTO menus (id, location_code, name, is_active) VALUES
    ('d0000001-0000-0000-0000-000000000001', 'header_main', 'Main Header Navbar', TRUE),
    ('d0000002-0000-0000-0000-000000000002', 'mega_publication', 'Mega Menu Publication', TRUE),
    ('d0000003-0000-0000-0000-000000000003', 'footer_links', 'Footer Navigation Links', TRUE)
ON CONFLICT (location_code) DO NOTHING;

-- Header Main Items
INSERT INTO menu_items (menu_id, parent_id, label, url, sort_order, is_active) VALUES
    ('d0000001-0000-0000-0000-000000000001', NULL, 'About', '/about', 1, TRUE),
    ('d0000001-0000-0000-0000-000000000001', NULL, 'Collection', '/collection', 2, TRUE),
    ('d0000001-0000-0000-0000-000000000001', NULL, 'Exhibition', '/exhibition', 3, TRUE),
    ('d0000001-0000-0000-0000-000000000001', NULL, 'Publication', '/publication', 4, TRUE),
    ('d0000001-0000-0000-0000-000000000001', NULL, 'Visit', '/visit', 5, TRUE);
