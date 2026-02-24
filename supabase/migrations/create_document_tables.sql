-- Document categories (tabs like KET, HOLDING_SH, INTERNAL, BLORA, etc.)
CREATE TABLE document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Documents per category
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES document_categories(id) ON DELETE CASCADE,
  tanggal date,
  deskripsi text,
  jenis_dokumen text,
  link text,
  pengisi text,
  penerbi text,
  has_softfile boolean NOT NULL DEFAULT false,
  has_hardfile boolean NOT NULL DEFAULT false,
  keterangan text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for faster lookups by category
CREATE INDEX idx_documents_category_id ON documents(category_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Enable RLS
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon (matching existing project pattern)
CREATE POLICY "Allow all for document_categories" ON document_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for documents" ON documents FOR ALL USING (true) WITH CHECK (true);
