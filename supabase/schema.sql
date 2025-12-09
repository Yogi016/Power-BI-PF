-- =====================================================
-- SCHEMA: Project Monitoring System
-- Description: Database schema untuk sistem pemantauan progress project
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: projects
-- Description: Menyimpan informasi utama project
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    pic VARCHAR(100) NOT NULL, -- Person In Charge
    description TEXT, -- Uraian Kegiatan/Program
    category VARCHAR(100), -- Kategori project (optional)
    location VARCHAR(255), -- Lokasi project (optional)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
    budget DECIMAL(15,2), -- Budget total (optional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX idx_projects_pic ON projects(pic);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);

-- =====================================================
-- TABLE: activities
-- Description: Menyimpan kegiatan/aktivitas per project
-- =====================================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code VARCHAR(50), -- Kode aktivitas (A, B, B.1, dll)
    activity_name VARCHAR(500) NOT NULL,
    category VARCHAR(100), -- Kategori aktivitas
    sub_category VARCHAR(100), -- Sub-kategori
    pic VARCHAR(100), -- PIC untuk aktivitas ini (bisa berbeda dari project PIC)
    weight DECIMAL(5,2) DEFAULT 0 CHECK (weight >= 0 AND weight <= 100), -- Bobot dalam project (%)
    start_week INTEGER, -- Minggu mulai (0-based index)
    end_week INTEGER, -- Minggu selesai (0-based index)
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'completed', 'delayed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_activities_project ON activities(project_id);
CREATE INDEX idx_activities_pic ON activities(pic);
CREATE INDEX idx_activities_status ON activities(status);

-- =====================================================
-- TABLE: weekly_progress
-- Description: Progress mingguan per aktivitas
-- =====================================================
CREATE TABLE IF NOT EXISTS weekly_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    week_index INTEGER NOT NULL, -- 0-based index (0 = minggu pertama)
    week_label VARCHAR(50) NOT NULL, -- Format: "Juni-1", "Juni-2", dll
    year INTEGER NOT NULL,
    progress_value DECIMAL(5,2) DEFAULT 0 CHECK (progress_value >= 0 AND progress_value <= 100), -- Progress dalam %
    notes TEXT, -- Catatan untuk minggu ini
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, week_index, year)
);

-- Index untuk performa
CREATE INDEX idx_weekly_progress_activity ON weekly_progress(activity_id);
CREATE INDEX idx_weekly_progress_week ON weekly_progress(week_index, year);

-- =====================================================
-- TABLE: monthly_progress
-- Description: Progress bulanan (agregasi dari weekly)
-- =====================================================
CREATE TABLE IF NOT EXISTS monthly_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL, -- Format: "Jan", "Feb", dll
    year INTEGER NOT NULL,
    month_index INTEGER NOT NULL CHECK (month_index >= 1 AND month_index <= 12),
    baseline DECIMAL(5,2) DEFAULT 0, -- Target progress (%)
    actual DECIMAL(5,2) DEFAULT 0, -- Actual progress (%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, month_index, year)
);

-- Index untuk performa
CREATE INDEX idx_monthly_progress_project ON monthly_progress(project_id);
CREATE INDEX idx_monthly_progress_date ON monthly_progress(year, month_index);

-- =====================================================
-- TABLE: s_curve_baseline
-- Description: Data baseline untuk S-Curve (planned progress)
-- =====================================================
CREATE TABLE IF NOT EXISTS s_curve_baseline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
    period_label VARCHAR(50) NOT NULL, -- "Juni-1" atau "Jan"
    period_index INTEGER NOT NULL, -- Week index atau month index
    year INTEGER NOT NULL,
    cumulative_baseline DECIMAL(5,2) DEFAULT 0, -- Kumulatif baseline (%)
    period_baseline DECIMAL(5,2) DEFAULT 0, -- Baseline untuk periode ini saja (%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, period_type, period_index, year)
);

-- Index untuk performa
CREATE INDEX idx_scurve_baseline_project ON s_curve_baseline(project_id);
CREATE INDEX idx_scurve_baseline_period ON s_curve_baseline(period_type, year);

-- =====================================================
-- TABLE: s_curve_actual
-- Description: Data actual untuk S-Curve (realized progress)
-- =====================================================
CREATE TABLE IF NOT EXISTS s_curve_actual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
    period_label VARCHAR(50) NOT NULL,
    period_index INTEGER NOT NULL,
    year INTEGER NOT NULL,
    cumulative_actual DECIMAL(5,2) DEFAULT 0, -- Kumulatif actual (%)
    period_actual DECIMAL(5,2) DEFAULT 0, -- Actual untuk periode ini saja (%)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, period_type, period_index, year)
);

-- Index untuk performa
CREATE INDEX idx_scurve_actual_project ON s_curve_actual(project_id);
CREATE INDEX idx_scurve_actual_period ON s_curve_actual(period_type, year);

-- =====================================================
-- FUNCTIONS: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers untuk auto-update
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_progress_updated_at BEFORE UPDATE ON weekly_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_progress_updated_at BEFORE UPDATE ON monthly_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scurve_baseline_updated_at BEFORE UPDATE ON s_curve_baseline
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scurve_actual_updated_at BEFORE UPDATE ON s_curve_actual
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS pada semua tabel
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE s_curve_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE s_curve_actual ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (untuk demo)
-- CATATAN: Untuk production, sebaiknya gunakan authentication
CREATE POLICY "Allow public read on projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow public read on activities" ON activities FOR SELECT USING (true);
CREATE POLICY "Allow public read on weekly_progress" ON weekly_progress FOR SELECT USING (true);
CREATE POLICY "Allow public read on monthly_progress" ON monthly_progress FOR SELECT USING (true);
CREATE POLICY "Allow public read on s_curve_baseline" ON s_curve_baseline FOR SELECT USING (true);
CREATE POLICY "Allow public read on s_curve_actual" ON s_curve_actual FOR SELECT USING (true);

-- Policy: Allow public insert/update (untuk demo)
-- CATATAN: Untuk production, sebaiknya batasi dengan authentication
CREATE POLICY "Allow public insert on projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on projects" ON projects FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on activities" ON activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on activities" ON activities FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on weekly_progress" ON weekly_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on weekly_progress" ON weekly_progress FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on monthly_progress" ON monthly_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on monthly_progress" ON monthly_progress FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on s_curve_baseline" ON s_curve_baseline FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on s_curve_baseline" ON s_curve_baseline FOR UPDATE USING (true);
CREATE POLICY "Allow public insert on s_curve_actual" ON s_curve_actual FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on s_curve_actual" ON s_curve_actual FOR UPDATE USING (true);

-- =====================================================
-- VIEWS: Helpful views untuk query yang sering digunakan
-- =====================================================

-- View: Project Summary dengan progress
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    p.id,
    p.name,
    p.pic,
    p.description,
    p.start_date,
    p.end_date,
    p.status,
    COUNT(DISTINCT a.id) as total_activities,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_activities,
    COALESCE(AVG(CASE WHEN a.status = 'completed' THEN 100 ELSE 0 END), 0) as completion_rate
FROM projects p
LEFT JOIN activities a ON p.id = a.project_id
GROUP BY p.id, p.name, p.pic, p.description, p.start_date, p.end_date, p.status;

-- View: Latest S-Curve data per project
CREATE OR REPLACE VIEW latest_scurve_data AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    b.period_type,
    b.period_label,
    b.year,
    b.cumulative_baseline,
    COALESCE(a.cumulative_actual, 0) as cumulative_actual,
    (COALESCE(a.cumulative_actual, 0) - b.cumulative_baseline) as variance
FROM projects p
LEFT JOIN s_curve_baseline b ON p.id = b.project_id
LEFT JOIN s_curve_actual a ON p.id = a.project_id 
    AND b.period_type = a.period_type 
    AND b.period_index = a.period_index 
    AND b.year = a.year
ORDER BY p.id, b.year, b.period_index;

-- =====================================================
-- COMMENTS: Dokumentasi tabel
-- =====================================================
COMMENT ON TABLE projects IS 'Tabel utama untuk menyimpan informasi project';
COMMENT ON TABLE activities IS 'Tabel untuk menyimpan aktivitas/kegiatan per project';
COMMENT ON TABLE weekly_progress IS 'Tabel untuk tracking progress mingguan per aktivitas';
COMMENT ON TABLE monthly_progress IS 'Tabel untuk tracking progress bulanan per project';
COMMENT ON TABLE s_curve_baseline IS 'Tabel untuk menyimpan baseline (planned) S-Curve data';
COMMENT ON TABLE s_curve_actual IS 'Tabel untuk menyimpan actual (realized) S-Curve data';
