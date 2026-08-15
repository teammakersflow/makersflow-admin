-- ================================================================
-- MakersFlow Admin — SQL to run in Supabase SQL Editor
-- Run ALL of these before deploying the admin panel
-- ================================================================

-- 1. Products: add weight_kg column for Shiprocket shipping
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,3) DEFAULT 0.500;

COMMENT ON COLUMN products.weight_kg IS
  'Product weight in kg for Shiprocket live shipping rate. Default 0.5kg.';

-- 2. Settings table (shipping fees, store info)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  label TEXT
);

-- Insert default shipping settings
INSERT INTO settings (key, value, label) VALUES
  ('shipping_fee',           '49',   'Standard shipping fee (₹)'),
  ('shipping_fee_remote',    '149',  'Remote area shipping fee (₹)'),
  ('free_shipping_threshold','999',  'Free shipping above (₹)'),
  ('store_name',             'MakersFlow', 'Store name'),
  ('support_email',          'team.makersflow@gmail.com', 'Support email'),
  ('store_phone',            '+91 83095 89858', 'Support phone'),
  ('gst_number',             '', 'GST number')
ON CONFLICT (key) DO NOTHING;

-- 3. Promotions/Banners table (home screen carousel)
CREATE TABLE IF NOT EXISTS promotions (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  subtitle      TEXT,
  image_url     TEXT,
  link          TEXT,
  is_active     BOOLEAN DEFAULT true,
  expires_at    TIMESTAMPTZ,
  display_order INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Push tokens table (for notifications)
CREATE TABLE IF NOT EXISTS push_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- 5. Notifications/Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT DEFAULT 'info',
  link_url     TEXT,
  status       TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Reviews: approved_comment for keeping approved text during edit
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS approved_comment TEXT;
ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS approved_comment TEXT;

-- 7. RLS policies — allow admin to read/write all tables
-- (Run this if you get "row-level security" errors in admin)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "admin_all_settings" ON settings
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "admin_all_promotions" ON promotions
  FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "user_own_token" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "admin_all_announcements" ON announcements
  FOR ALL USING (auth.role() = 'authenticated');

-- 8. Set product weights (update after running weight_kg column)
-- Edit these values to match your actual product weights
-- UPDATE products SET weight_kg = 0.050 WHERE title ILIKE '%bulb%';
-- UPDATE products SET weight_kg = 0.100 WHERE title ILIKE '%sensor%';
-- UPDATE products SET weight_kg = 0.500 WHERE title ILIKE '%kit%';
-- UPDATE products SET weight_kg = 0.000 WHERE category = 'digital';

-- Verify everything was created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('settings','promotions','push_tokens','announcements')
ORDER BY table_name;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'weight_kg';
