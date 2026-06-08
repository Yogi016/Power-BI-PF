-- =====================================================
-- Asset Page Tables Migration
-- Description: Stores team asset metadata for files uploaded to Cloudflare R2
-- Date: 2026-06-08
-- =====================================================

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint NOT NULL DEFAULT 0,
  category text,
  description text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_file_name ON assets USING gin (to_tsvector('simple', file_name));

CREATE OR REPLACE FUNCTION update_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assets_updated_at ON assets;
CREATE TRIGGER trigger_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_assets_updated_at();

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users for assets" ON assets;
CREATE POLICY "Allow authenticated users for assets" ON assets
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE assets TO authenticated;
