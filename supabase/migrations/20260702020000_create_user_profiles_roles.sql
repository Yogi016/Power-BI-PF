-- =====================================================
-- User role profiles
-- Description: Public role master and user profile mapping for app UI roles
-- =====================================================

CREATE TABLE IF NOT EXISTS app_roles (
    code TEXT PRIMARY KEY CHECK (code IN ('vp_lingkungan', 'project_manager', 'project_head', 'staff_officer')),
    label TEXT NOT NULL,
    short_label TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO app_roles (code, label, short_label, description, sort_order) VALUES
    ('vp_lingkungan', 'VP Lingkungan', 'VP', 'Executive approval, dokumen strategis, dan pemantauan risiko lintas portfolio.', 1),
    ('project_manager', 'Project Manager', 'PM', 'Validasi portfolio, kelengkapan dokumen, dan bottleneck lintas Project Head.', 2),
    ('project_head', 'Project Head', 'PH', 'Review substansi program, evidence project, dan tindak lanjut implementasi.', 3),
    ('staff_officer', 'Staff Officer', 'Staff', 'Draft dokumen, upload versi, metadata, dan update evidence operasional.', 4)
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    short_label = EXCLUDED.short_label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role_code TEXT NOT NULL REFERENCES app_roles(code) DEFAULT 'staff_officer',
    assigned_project_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role_code ON user_profiles(role_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read app roles" ON app_roles;
CREATE POLICY "Allow authenticated read app roles" ON app_roles
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow users read own profile" ON user_profiles;
CREATE POLICY "Allow users read own profile" ON user_profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON TABLE app_roles TO authenticated;
GRANT SELECT ON TABLE user_profiles TO authenticated;

COMMENT ON TABLE app_roles IS 'Master role list shown in role dropdowns and used by the app.';
COMMENT ON TABLE user_profiles IS 'Operational app profile for Supabase Auth users. Users are created in Supabase Auth, then assigned a role here.';
