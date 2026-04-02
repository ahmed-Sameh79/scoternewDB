-- ============================================================
-- MOTO ERP — Supabase Full Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── 0. EXTENSIONS ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. ENUM TYPES ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'storekeeper', 'technician', 'sales');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE motorcycle_status AS ENUM ('available', 'sold', 'in_service', 'pre_owned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE motorcycle_condition AS ENUM ('new', 'used');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE part_condition AS ENUM ('new', 'used');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_order_status AS ENUM ('draft', 'pending', 'in_progress', 'parts_reserved', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'paid', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inspection_grade AS ENUM ('excellent', 'good', 'fair', 'poor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. PROFILES (extends auth.users) ────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'sales',
  email       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'sales'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── 3. WAREHOUSES & BINS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zones (
  id           SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aisles (
  id         SERIAL PRIMARY KEY,
  zone_id    INTEGER NOT NULL REFERENCES zones(id),
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shelves (
  id         SERIAL PRIMARY KEY,
  aisle_id   INTEGER NOT NULL REFERENCES aisles(id),
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bins (
  id           SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  shelf_id     INTEGER REFERENCES shelves(id),
  zone         TEXT NOT NULL,
  aisle        TEXT NOT NULL,
  shelf        TEXT NOT NULL,
  bin          TEXT NOT NULL,
  label        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. CATEGORIES & METADATA ─────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcategories (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS motorcycle_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS motorcycle_subcategories (
  id                       SERIAL PRIMARY KEY,
  motorcycle_category_id   INTEGER NOT NULL REFERENCES motorcycle_categories(id),
  name                     TEXT NOT NULL,
  description              TEXT,
  image_url                TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS motorcycle_brands (
  id                     SERIAL PRIMARY KEY,
  motorcycle_category_id INTEGER REFERENCES motorcycle_categories(id),
  name                   TEXT NOT NULL,
  description            TEXT,
  image_url              TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. VENDORS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  tax_number      TEXT,
  notes           TEXT,
  total_purchased NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. PARTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parts (
  id                 SERIAL PRIMARY KEY,
  sku                TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  condition          part_condition NOT NULL DEFAULT 'new',
  model_compatibility TEXT,
  subcategory_id     INTEGER REFERENCES subcategories(id),
  quantity_on_hand   INTEGER NOT NULL DEFAULT 0,
  reorder_point      INTEGER NOT NULL DEFAULT 5,
  cost_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url          TEXT,
  warehouse_id       INTEGER REFERENCES warehouses(id),
  bin_id             INTEGER REFERENCES bins(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. MOTORCYCLES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS motorcycles (
  id                       SERIAL PRIMARY KEY,
  make                     TEXT NOT NULL,
  model                    TEXT NOT NULL,
  year                     INTEGER NOT NULL,
  vin                      TEXT,
  color                    TEXT,
  engine_size              TEXT,
  mileage                  INTEGER,
  condition                motorcycle_condition NOT NULL DEFAULT 'new',
  status                   motorcycle_status NOT NULL DEFAULT 'available',
  brand_id                 INTEGER REFERENCES motorcycle_brands(id),
  motorcycle_subcategory_id INTEGER REFERENCES motorcycle_subcategories(id),
  subcategory_id           INTEGER REFERENCES subcategories(id),
  cost_price               NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url                TEXT,
  engine_cc                INTEGER,
  top_speed                INTEGER,
  fuel_capacity            NUMERIC(5,2),
  weight                   INTEGER,
  seat_height              INTEGER,
  transmission             TEXT,
  fuel_type                TEXT,
  features                 TEXT,
  warehouse_id             INTEGER REFERENCES warehouses(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. PURCHASE ORDERS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id           SERIAL PRIMARY KEY,
  po_number    TEXT NOT NULL UNIQUE,
  vendor_id    INTEGER NOT NULL REFERENCES vendors(id),
  status       po_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  ordered_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  part_id           INTEGER NOT NULL REFERENCES parts(id),
  quantity          INTEGER NOT NULL,
  unit_cost         NUMERIC(12,2) NOT NULL,
  total_cost        NUMERIC(14,2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. GRN ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grn (
  id                SERIAL PRIMARY KEY,
  grn_number        TEXT NOT NULL UNIQUE,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by       UUID REFERENCES auth.users(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grn_lines (
  id                INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  grn_id            INTEGER NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
  part_id           INTEGER NOT NULL REFERENCES parts(id),
  quantity_received INTEGER NOT NULL,
  bin_id            INTEGER REFERENCES bins(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 10. WORK ORDERS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id               SERIAL PRIMARY KEY,
  wo_number        TEXT NOT NULL UNIQUE,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  motorcycle_id    INTEGER REFERENCES motorcycles(id),
  description      TEXT NOT NULL,
  status           work_order_status NOT NULL DEFAULT 'draft',
  assigned_to      UUID REFERENCES auth.users(id),
  labor_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_parts_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_order_parts (
  id            SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id       INTEGER NOT NULL REFERENCES parts(id),
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 11. INVOICES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  TEXT NOT NULL UNIQUE,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  customer_email  TEXT,
  status          invoice_status NOT NULL DEFAULT 'draft',
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method  TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id            SERIAL PRIMARY KEY,
  invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  motorcycle_id INTEGER REFERENCES motorcycles(id),
  part_id       INTEGER REFERENCES parts(id),
  description   TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL,
  total_price   NUMERIC(14,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS returns (
  id             SERIAL PRIMARY KEY,
  invoice_id     INTEGER NOT NULL REFERENCES invoices(id),
  reason         TEXT NOT NULL,
  refund_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 12. INSPECTIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspections (
  id                    SERIAL PRIMARY KEY,
  motorcycle_id         INTEGER NOT NULL REFERENCES motorcycles(id),
  inspector_id          UUID REFERENCES auth.users(id),
  overall_grade         inspection_grade NOT NULL,
  engine_condition      TEXT,
  body_condition        TEXT,
  electrical_condition  TEXT,
  tires_condition       TEXT,
  brake_condition       TEXT,
  notes                 TEXT,
  image_urls            TEXT[],
  is_certified          BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 13. AUDIT LOGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id),
  action     audit_action NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  before     JSONB,
  after      JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 14. DOCUMENT SEQUENCES ───────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequences (
  id         SERIAL PRIMARY KEY,
  prefix     TEXT NOT NULL UNIQUE,
  last_value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO document_sequences (prefix, last_value) VALUES
  ('PO', 0), ('WO', 0), ('INV', 0), ('GRN', 0)
ON CONFLICT (prefix) DO NOTHING;

-- Atomic sequence increment function
CREATE OR REPLACE FUNCTION next_document_number(p_prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_next INTEGER;
BEGIN
  UPDATE document_sequences
    SET last_value = last_value + 1
    WHERE prefix = p_prefix
    RETURNING last_value INTO v_next;
  RETURN p_prefix || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- ─── 15. SITE SETTINGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id         SERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 16. updated_at TRIGGER ───────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','warehouses','categories','subcategories',
    'motorcycle_categories','motorcycle_subcategories','motorcycle_brands','vendors',
    'parts','motorcycles','purchase_orders','work_orders','invoices','inspections'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ─── 17. HELPER: get current user role ────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid()
$$;

-- ─── 18. ENABLE RLS ───────────────────────────────────────
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE aisles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelves              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycle_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycle_subcategories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycle_brands         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE motorcycles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_lines            ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_parts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions  ENABLE ROW LEVEL SECURITY;

-- ─── 19. RLS POLICIES ─────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "profiles_read" ON profiles;
CREATE POLICY "profiles_read" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_admin_write" ON profiles;
CREATE POLICY "profiles_admin_write" ON profiles FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- warehouses / bins / zones / aisles / shelves
DROP POLICY IF EXISTS "warehouses_read" ON warehouses;
CREATE POLICY "warehouses_read" ON warehouses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "warehouses_write" ON warehouses;
CREATE POLICY "warehouses_write" ON warehouses FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

DROP POLICY IF EXISTS "bins_read" ON bins;
CREATE POLICY "bins_read" ON bins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bins_write" ON bins;
CREATE POLICY "bins_write" ON bins FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

DROP POLICY IF EXISTS "zones_read" ON zones;
CREATE POLICY "zones_read" ON zones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "aisles_read" ON aisles;
CREATE POLICY "aisles_read" ON aisles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shelves_read" ON shelves;
CREATE POLICY "shelves_read" ON shelves FOR SELECT TO authenticated USING (true);

-- categories
DROP POLICY IF EXISTS "categories_read" ON categories;
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "categories_write" ON categories;
CREATE POLICY "categories_write" ON categories FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

DROP POLICY IF EXISTS "subcategories_read" ON subcategories;
CREATE POLICY "subcategories_read" ON subcategories FOR SELECT USING (true);
DROP POLICY IF EXISTS "subcategories_write" ON subcategories;
CREATE POLICY "subcategories_write" ON subcategories FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

DROP POLICY IF EXISTS "moto_cats_read" ON motorcycle_categories;
CREATE POLICY "moto_cats_read" ON motorcycle_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "moto_cats_write" ON motorcycle_categories;
CREATE POLICY "moto_cats_write" ON motorcycle_categories FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

DROP POLICY IF EXISTS "moto_subcats_read" ON motorcycle_subcategories;
CREATE POLICY "moto_subcats_read" ON motorcycle_subcategories FOR SELECT USING (true);
DROP POLICY IF EXISTS "moto_subcats_write" ON motorcycle_subcategories;
CREATE POLICY "moto_subcats_write" ON motorcycle_subcategories FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

DROP POLICY IF EXISTS "moto_brands_read" ON motorcycle_brands;
CREATE POLICY "moto_brands_read" ON motorcycle_brands FOR SELECT USING (true);
DROP POLICY IF EXISTS "moto_brands_write" ON motorcycle_brands;
CREATE POLICY "moto_brands_write" ON motorcycle_brands FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

-- vendors
DROP POLICY IF EXISTS "vendors_read" ON vendors;
CREATE POLICY "vendors_read" ON vendors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vendors_write" ON vendors;
CREATE POLICY "vendors_write" ON vendors FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

-- parts
DROP POLICY IF EXISTS "parts_read" ON parts;
CREATE POLICY "parts_read" ON parts FOR SELECT USING (true);
DROP POLICY IF EXISTS "parts_write" ON parts;
CREATE POLICY "parts_write" ON parts FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

-- motorcycles
DROP POLICY IF EXISTS "motorcycles_read" ON motorcycles;
CREATE POLICY "motorcycles_read" ON motorcycles FOR SELECT USING (true);
DROP POLICY IF EXISTS "motorcycles_write" ON motorcycles;
CREATE POLICY "motorcycles_write" ON motorcycles FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

-- purchase orders
DROP POLICY IF EXISTS "po_read" ON purchase_orders;
CREATE POLICY "po_read" ON purchase_orders FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','storekeeper'));
DROP POLICY IF EXISTS "po_write" ON purchase_orders;
CREATE POLICY "po_write" ON purchase_orders FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

DROP POLICY IF EXISTS "po_lines_read" ON purchase_order_lines;
CREATE POLICY "po_lines_read" ON purchase_order_lines FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','storekeeper'));
DROP POLICY IF EXISTS "po_lines_write" ON purchase_order_lines;
CREATE POLICY "po_lines_write" ON purchase_order_lines FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

-- GRN
DROP POLICY IF EXISTS "grn_read" ON grn;
CREATE POLICY "grn_read" ON grn FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','storekeeper'));
DROP POLICY IF EXISTS "grn_write" ON grn;
CREATE POLICY "grn_write" ON grn FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));
DROP POLICY IF EXISTS "grn_lines_read" ON grn_lines;
CREATE POLICY "grn_lines_read" ON grn_lines FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','storekeeper'));
DROP POLICY IF EXISTS "grn_lines_write" ON grn_lines;
CREATE POLICY "grn_lines_write" ON grn_lines FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','storekeeper')) WITH CHECK (get_my_role() IN ('admin','storekeeper'));

-- work orders
DROP POLICY IF EXISTS "wo_read" ON work_orders;
CREATE POLICY "wo_read" ON work_orders FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','technician','storekeeper'));
DROP POLICY IF EXISTS "wo_write" ON work_orders;
CREATE POLICY "wo_write" ON work_orders FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','technician')) WITH CHECK (get_my_role() IN ('admin','technician'));

DROP POLICY IF EXISTS "wo_parts_read" ON work_order_parts;
CREATE POLICY "wo_parts_read" ON work_order_parts FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','technician','storekeeper'));
DROP POLICY IF EXISTS "wo_parts_write" ON work_order_parts;
CREATE POLICY "wo_parts_write" ON work_order_parts FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','technician')) WITH CHECK (get_my_role() IN ('admin','technician'));

-- invoices
DROP POLICY IF EXISTS "invoices_read" ON invoices;
CREATE POLICY "invoices_read" ON invoices FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','sales'));
DROP POLICY IF EXISTS "invoices_write" ON invoices;
CREATE POLICY "invoices_write" ON invoices FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

DROP POLICY IF EXISTS "invoice_lines_read" ON invoice_lines;
CREATE POLICY "invoice_lines_read" ON invoice_lines FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','sales'));
DROP POLICY IF EXISTS "invoice_lines_write" ON invoice_lines;
CREATE POLICY "invoice_lines_write" ON invoice_lines FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

DROP POLICY IF EXISTS "returns_read" ON returns;
CREATE POLICY "returns_read" ON returns FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','sales'));
DROP POLICY IF EXISTS "returns_write" ON returns;
CREATE POLICY "returns_write" ON returns FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','sales')) WITH CHECK (get_my_role() IN ('admin','sales'));

-- inspections
DROP POLICY IF EXISTS "inspections_read" ON inspections;
CREATE POLICY "inspections_read" ON inspections FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin','technician'));
DROP POLICY IF EXISTS "inspections_write" ON inspections;
CREATE POLICY "inspections_write" ON inspections FOR ALL TO authenticated
  USING (get_my_role() IN ('admin','technician')) WITH CHECK (get_my_role() IN ('admin','technician'));

-- audit logs
DROP POLICY IF EXISTS "audit_read" ON audit_logs;
CREATE POLICY "audit_read" ON audit_logs FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- site settings (public read, admin write)
DROP POLICY IF EXISTS "site_settings_read" ON site_settings;
CREATE POLICY "site_settings_read" ON site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "site_settings_write" ON site_settings;
CREATE POLICY "site_settings_write" ON site_settings FOR ALL TO authenticated
  USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- contact submissions
DROP POLICY IF EXISTS "contact_insert" ON contact_submissions;
CREATE POLICY "contact_insert" ON contact_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "contact_read" ON contact_submissions;
CREATE POLICY "contact_read" ON contact_submissions FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
DROP POLICY IF EXISTS "contact_update" ON contact_submissions;
CREATE POLICY "contact_update" ON contact_submissions FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

-- ─── 20. SEED DATA ────────────────────────────────────────
-- Site settings
INSERT INTO site_settings (key, value) VALUES
  ('site_name', 'MotoShop'),
  ('site_name_ar', 'موتوشوب'),
  ('hero_title', 'Your Premier Motorcycle Destination'),
  ('hero_title_ar', 'وجهتك الأولى للدراجات النارية'),
  ('hero_subtitle', 'New, Pre-Owned & Custom Motorcycles'),
  ('hero_subtitle_ar', 'دراجات جديدة ومستعملة وقطع غيار'),
  ('contact_email', 'info@motoshop.com'),
  ('contact_phone', '+60312345678'),
  ('contact_address', 'Jalan Merdeka 1, Kuala Lumpur')
ON CONFLICT (key) DO NOTHING;

-- Document sequences
INSERT INTO document_sequences (prefix, last_value) VALUES
  ('PO', 0), ('WO', 0), ('INV', 0), ('GRN', 0)
ON CONFLICT (prefix) DO NOTHING;

-- ─── 21. CREATE AUTH USERS + PROFILES ────────────────────
-- Run this section AFTER creating users via Supabase Dashboard → Authentication → Users
-- OR use the seed-users.sql script provided separately.
-- Credentials:
--   admin@motoshop.com    / Admin1234!   (role: admin)
--   ali@motoshop.com      / Store1234!   (role: storekeeper)
--   rahman@motoshop.com   / Tech1234!    (role: technician)
--   siti@motoshop.com     / Sales1234!   (role: sales)

-- ─── DONE ─────────────────────────────────────────────────
SELECT 'Migration complete! Tables created with RLS.' AS status;
