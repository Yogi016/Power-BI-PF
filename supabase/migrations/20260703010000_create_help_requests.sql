-- =====================================================
-- Coordination Hub: directed help requests + threaded replies
-- =====================================================

CREATE TABLE IF NOT EXISTS help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject VARCHAR(300) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_help_requests_to ON help_requests(to_user);
CREATE INDEX IF NOT EXISTS idx_help_requests_from ON help_requests(from_user);
CREATE INDEX IF NOT EXISTS idx_help_requests_updated ON help_requests(updated_at DESC);

CREATE TABLE IF NOT EXISTS help_request_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    sender_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_messages_request ON help_request_messages(request_id, created_at);

CREATE TABLE IF NOT EXISTS help_request_reads (
    request_id UUID NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (request_id, user_id)
);

-- updated_at trigger (function already defined in schema.sql)
CREATE TRIGGER update_help_requests_updated_at
    BEFORE UPDATE ON help_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS (participant-based; routing is any -> any)
-- =====================================================
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_request_reads ENABLE ROW LEVEL SECURITY;

-- help_requests
CREATE POLICY hr_select ON help_requests FOR SELECT TO authenticated
    USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY hr_insert ON help_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = from_user);
CREATE POLICY hr_update ON help_requests FOR UPDATE TO authenticated
    USING (auth.uid() = from_user OR auth.uid() = to_user)
    WITH CHECK (auth.uid() = from_user OR auth.uid() = to_user);

-- help_request_messages (participant of the parent request)
CREATE POLICY hrm_select ON help_request_messages FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM help_requests r
        WHERE r.id = help_request_messages.request_id
          AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
    ));
CREATE POLICY hrm_insert ON help_request_messages FOR INSERT TO authenticated
    WITH CHECK (
        sender_user = auth.uid()
        AND EXISTS (
            SELECT 1 FROM help_requests r
            WHERE r.id = help_request_messages.request_id
              AND (auth.uid() = r.from_user OR auth.uid() = r.to_user)
        )
    );

-- help_request_reads (each user manages own rows)
CREATE POLICY hrr_all ON help_request_reads FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
