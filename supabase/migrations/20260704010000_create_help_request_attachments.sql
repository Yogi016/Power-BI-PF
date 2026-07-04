-- =====================================================
-- Chat JS attachments: files linked to a help request (initial or per-reply)
-- =====================================================
CREATE TABLE IF NOT EXISTS help_request_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    message_id UUID REFERENCES help_request_messages(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'document')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_attachments_request ON help_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_hr_attachments_message ON help_request_attachments(message_id);

ALTER TABLE help_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY hra_select ON help_request_attachments FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM help_requests r
        WHERE r.id = help_request_attachments.request_id
          AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
    ));
CREATE POLICY hra_insert ON help_request_attachments FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM help_requests r
            WHERE r.id = help_request_attachments.request_id
              AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
        )
    );
