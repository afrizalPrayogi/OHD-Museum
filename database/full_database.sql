-- =============================================================================
-- OHD MUSEUM DATABASE SCHEMA
-- PostgreSQL Version 14+ compatible
-- Normalized: 3NF (Third Normal Form) with Hybrid Document Model (JSONB)
-- Architecture: Decoupled CMS & Public Exhibition Portal
-- =============================================================================

-- Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- Function: Auto-update updated_at timestamp
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. AUTHORIZATION MODULE: ROLES & PERMISSIONS (RBAC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- =============================================================================
-- 2. AUTHENTICATION MODULE: USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 3. AUDIT TRAIL MODULE: LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL, -- LOGIN, LOGOUT, CREATE, UPDATE, DELETE, PUBLISH
    entity_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. CATEGORY MANAGEMENT MODULE: CENTRAL TAXONOMY
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'artwork_medium', 'artwork_era', 'article_topic', 'document_type'
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. CORE ART ASSETS: ARTISTS (MAESTRO)
-- =============================================================================

CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    biography TEXT,
    portrait_url TEXT,
    era_period VARCHAR(100), -- Mooi Indie, Persagi, Modern, Contemporary
    birth_year INT,
    death_year INT,
    is_prominent BOOLEAN NOT NULL DEFAULT FALSE, -- Featured in Marquee
    locale VARCHAR(5) NOT NULL DEFAULT 'id',
    translation_of_id UUID REFERENCES artists(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_artist_locale CHECK (locale IN ('id', 'en'))
);

DROP TRIGGER IF EXISTS trg_artists_updated_at ON artists;
CREATE TRIGGER trg_artists_updated_at
BEFORE UPDATE ON artists
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 6. CORE ART ASSETS: ARTWORKS (COLLECTION EXPLORER)
-- =============================================================================

CREATE TABLE IF NOT EXISTS artworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    creation_year INT,
    medium VARCHAR(150),
    dimensions VARCHAR(100),
    description TEXT,
    image_url TEXT NOT NULL, -- High-res Cloudinary asset URL
    is_featured BOOLEAN NOT NULL DEFAULT FALSE, -- Shown in Featured Collection
    exhibition_status VARCHAR(30) NOT NULL DEFAULT 'on_display', -- 'on_display', 'in_storage', 'on_loan'
    locale VARCHAR(5) NOT NULL DEFAULT 'id',
    translation_of_id UUID REFERENCES artworks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_artwork_locale CHECK (locale IN ('id', 'en'))
);

DROP TRIGGER IF EXISTS trg_artworks_updated_at ON artworks;
CREATE TRIGGER trg_artworks_updated_at
BEFORE UPDATE ON artworks
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 7. EXHIBITION CALENDAR & M:N ARTWORKS LINK
-- =============================================================================

CREATE TABLE IF NOT EXISTS exhibitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(250) NOT NULL UNIQUE,
    curator_name VARCHAR(150),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'upcoming', -- 'current', 'upcoming', 'past'
    cover_image_url TEXT NOT NULL,
    essay JSONB, -- Rich-text blocks / curator essay
    venue_room VARCHAR(100),
    locale VARCHAR(5) NOT NULL DEFAULT 'id',
    translation_of_id UUID REFERENCES exhibitions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_exhibition_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_exhibition_locale CHECK (locale IN ('id', 'en'))
);

DROP TRIGGER IF EXISTS trg_exhibitions_updated_at ON exhibitions;
CREATE TRIGGER trg_exhibitions_updated_at
BEFORE UPDATE ON exhibitions
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TABLE IF NOT EXISTS exhibition_artworks (
    exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
    artwork_id UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (exhibition_id, artwork_id),
    CONSTRAINT chk_exh_art_sort CHECK (sort_order >= 0)
);

-- =============================================================================
-- 8. ARTICLE MANAGEMENT MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(250) NOT NULL,
    slug VARCHAR(280) NOT NULL UNIQUE,
    excerpt TEXT,
    content JSONB NOT NULL, -- Rich-text blocks
    cover_image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
    locale VARCHAR(5) NOT NULL DEFAULT 'id',
    translation_of_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_article_locale CHECK (locale IN ('id', 'en')),
    CONSTRAINT chk_article_status CHECK (status IN ('draft', 'published', 'archived'))
);

DROP TRIGGER IF EXISTS trg_articles_updated_at ON articles;
CREATE TRIGGER trg_articles_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 9. PUBLICATION & BOOKS MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(250) NOT NULL,
    author_editor VARCHAR(200),
    isbn VARCHAR(30) UNIQUE,
    publish_year INT,
    synopsis TEXT,
    cover_image_url TEXT NOT NULL,
    sample_pdf_url TEXT,
    order_wa_link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_books_updated_at ON books;
CREATE TRIGGER trg_books_updated_at
BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 10. DOCUMENT MANAGEMENT MODULE (ASSETS & BROCHURES)
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(30) NOT NULL, -- 'pdf', 'docx', 'zip', 'jpg'
    file_size_kb INT NOT NULL DEFAULT 0,
    download_count INT NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_doc_size CHECK (file_size_kb >= 0),
    CONSTRAINT chk_doc_downloads CHECK (download_count >= 0)
);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 11. MENU MANAGEMENT MODULE (DYNAMIC NAVIGATION)
-- =============================================================================

CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_code VARCHAR(50) NOT NULL UNIQUE, -- 'header_main', 'mega_publication', 'footer'
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    target_blank BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_menu_item_sort CHECK (sort_order >= 0)
);

-- =============================================================================
-- 12. PAGES MANAGEMENT MODULE (ABOUT, VISIT GUIDE, STATIC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(150) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    content JSONB NOT NULL,
    template_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- 'museum_about', 'drohd_profile', 'visit_guide', 'standard'
    meta_title VARCHAR(200),
    meta_description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    locale VARCHAR(5) NOT NULL DEFAULT 'id',
    translation_of_id UUID REFERENCES pages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_page_locale CHECK (locale IN ('id', 'en'))
);

DROP TRIGGER IF EXISTS trg_pages_updated_at ON pages;
CREATE TRIGGER trg_pages_updated_at
BEFORE UPDATE ON pages
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 13. BANNER MANAGEMENT MODULE (HERO SLIDERS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(255),
    desktop_image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    cta_text VARCHAR(50),
    cta_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_banner_sort CHECK (sort_order >= 0)
);

DROP TRIGGER IF EXISTS trg_banners_updated_at ON banners;
CREATE TRIGGER trg_banners_updated_at
BEFORE UPDATE ON banners
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 14. TICKETING & VISIT RESERVATION MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    whatsapp_number VARCHAR(30) NOT NULL,
    email VARCHAR(150) NOT NULL,
    institution_city VARCHAR(150),
    visit_date DATE NOT NULL,
    visit_time_slot VARCHAR(30) NOT NULL, -- 'morning', 'afternoon'
    total_adults INT NOT NULL DEFAULT 1,
    total_students INT NOT NULL DEFAULT 0,
    need_guide BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'completed'
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_res_adults CHECK (total_adults >= 0),
    CONSTRAINT chk_res_students CHECK (total_students >= 0),
    CONSTRAINT chk_res_status CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'))
);

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON reservations;
CREATE TRIGGER trg_reservations_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 15. CONTACT MANAGEMENT MODULE (INQUIRIES)
-- =============================================================================

CREATE TABLE IF NOT EXISTS contact_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    topic VARCHAR(50) NOT NULL DEFAULT 'general', -- 'general', 'research', 'partnership', 'ticketing'
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unread', -- 'unread', 'read', 'replied', 'archived'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_inquiry_status CHECK (status IN ('unread', 'read', 'replied', 'archived'))
);

DROP TRIGGER IF EXISTS trg_contact_inquiries_updated_at ON contact_inquiries;
CREATE TRIGGER trg_contact_inquiries_updated_at
BEFORE UPDATE ON contact_inquiries
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- 16. SYSTEM CONFIGURATION MODULE
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    group_name VARCHAR(50) NOT NULL DEFAULT 'general', -- 'general', 'contact', 'ticketing', 'seo'
    description VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- INDEXES FOR PERFORMANCE & FULL-TEXT SEARCH
-- =============================================================================

-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON audit_logs(entity_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artworks_category_id ON artworks(category_id);
CREATE INDEX IF NOT EXISTS idx_exhibition_artworks_art_id ON exhibition_artworks(artwork_id);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_id);

-- Lookup and Filter Indexes
CREATE INDEX IF NOT EXISTS idx_artworks_featured ON artworks(is_featured) WHERE is_featured IS TRUE;
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(exhibition_status);
CREATE INDEX IF NOT EXISTS idx_artists_prominent ON artists(is_prominent) WHERE is_prominent IS TRUE;
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_exhibitions_status ON exhibitions(status);
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_banners_sort_active ON banners(sort_order ASC) WHERE is_active IS TRUE;
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(visit_date, visit_time_slot);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);

-- GIN Trigram Indexes for Search Module
CREATE INDEX IF NOT EXISTS idx_artworks_title_trgm ON artworks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING gin (title gin_trgm_ops);


-- =============================================================================
-- INITIAL SEED DATA EXECUTION
-- =============================================================================

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
    '$2a$12$e0X9qfWkX4zKz8w7B.i4cebUfg27V2yGzU4b6QvWJ6eU5rM6iJd9i',
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
