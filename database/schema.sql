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
