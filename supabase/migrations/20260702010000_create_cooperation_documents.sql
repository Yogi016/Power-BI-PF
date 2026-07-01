-- =====================================================
-- Cooperation Documents Workflow
-- Description: PKS/MOU registry, version history, approval audit, and project links
-- =====================================================

CREATE TABLE IF NOT EXISTS cooperation_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('PKS', 'MOU', 'MoA', 'Addendum', 'BAST', 'NDA', 'SK', 'Surat Dukungan', 'Lainnya')),
    partner_name TEXT NOT NULL,
    document_number TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'usulan' CHECK (status IN (
        'usulan',
        'draft-internal',
        'review-project-head',
        'review-legal-internal',
        'review-mitra',
        'revisi-final',
        'validasi-project-manager',
        'menunggu-approval-vp',
        'disetujui-vp',
        'siap-ttd',
        'proses-ttd',
        'aktif',
        'monitoring-implementasi',
        'selesai',
        'expired',
        'diperpanjang',
        'diarsipkan'
    )),
    internal_pic TEXT NOT NULL,
    project_head TEXT,
    project_manager TEXT,
    scope_summary TEXT,
    legal_internal_notes TEXT,
    partner_notes TEXT,
    current_version_id UUID,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cooperation_document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES cooperation_documents(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_key TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_at_upload TEXT NOT NULL,
    revision_notes TEXT,
    revision_source TEXT CHECK (revision_source IN ('internal', 'project-head', 'project-manager', 'vp', 'mitra'))
);

ALTER TABLE cooperation_documents
    DROP CONSTRAINT IF EXISTS cooperation_documents_current_version_id_fkey;

ALTER TABLE cooperation_documents
    ADD CONSTRAINT cooperation_documents_current_version_id_fkey
    FOREIGN KEY (current_version_id)
    REFERENCES cooperation_document_versions(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS cooperation_document_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES cooperation_documents(id) ON DELETE CASCADE,
    approver_role TEXT NOT NULL CHECK (approver_role IN ('vp_lingkungan', 'project_manager', 'project_head', 'staff_officer')),
    approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_revision')),
    comment TEXT,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cooperation_document_project_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES cooperation_documents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_name TEXT NOT NULL,
    document_weight DECIMAL(5,2) NOT NULL DEFAULT 20 CHECK (document_weight >= 0 AND document_weight <= 20),
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT,
    action TEXT NOT NULL,
    from_value JSONB,
    to_value JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cooperation_documents_status ON cooperation_documents(status);
CREATE INDEX IF NOT EXISTS idx_cooperation_documents_type ON cooperation_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_cooperation_documents_end_date ON cooperation_documents(end_date);
CREATE INDEX IF NOT EXISTS idx_cooperation_versions_document ON cooperation_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_cooperation_approvals_document ON cooperation_document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_cooperation_project_links_document ON cooperation_document_project_links(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);

DROP TRIGGER IF EXISTS update_cooperation_documents_updated_at ON cooperation_documents;

CREATE TRIGGER update_cooperation_documents_updated_at
    BEFORE UPDATE ON cooperation_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE cooperation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperation_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperation_document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperation_document_project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Phase 1 policy: every authenticated user can see the Dokumen page.
-- Record-level role scoping can be tightened after Supabase profile metadata is deployed.
DROP POLICY IF EXISTS "Allow authenticated cooperation documents" ON cooperation_documents;
CREATE POLICY "Allow authenticated cooperation documents" ON cooperation_documents
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated cooperation versions" ON cooperation_document_versions;
CREATE POLICY "Allow authenticated cooperation versions" ON cooperation_document_versions
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated cooperation approvals" ON cooperation_document_approvals;
CREATE POLICY "Allow authenticated cooperation approvals" ON cooperation_document_approvals
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated cooperation project links" ON cooperation_document_project_links;
CREATE POLICY "Allow authenticated cooperation project links" ON cooperation_document_project_links
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated audit events" ON audit_events;
CREATE POLICY "Allow authenticated audit events" ON audit_events
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cooperation_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cooperation_document_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cooperation_document_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cooperation_document_project_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_events TO authenticated;

COMMENT ON TABLE cooperation_documents IS 'Registry PKS/MOU dan dokumen kerja sama Fungsi Lingkungan.';
COMMENT ON TABLE cooperation_document_versions IS 'Riwayat draft/final/signed document untuk Dokumen Kerja Sama.';
COMMENT ON TABLE cooperation_document_approvals IS 'Audit approval Project Head, Project Manager, dan VP Lingkungan.';
COMMENT ON TABLE cooperation_document_project_links IS 'Link dokumen kerja sama ke project dan bobot pool dokumen.';
COMMENT ON TABLE audit_events IS 'General audit trail untuk workflow penting.';
