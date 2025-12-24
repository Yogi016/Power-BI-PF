-- =====================================================
-- Work Page Tables Migration
-- Description: Creates tables for Work page - worker productivity and S-curve tracking
-- Date: 2024-12-24
-- =====================================================

-- Work Projects (Fases) Table
CREATE TABLE IF NOT EXISTS work_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    fase_name TEXT NOT NULL,
    target DECIMAL NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    manpower_eksisting INT NOT NULL DEFAULT 0,
    productivity_target DECIMAL NOT NULL DEFAULT 0, -- bibit/orang/day
    obstacle TEXT,
    action_plan TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (project_name, fase_name)
);

-- Daily Work Data Table (for S-Curve)
CREATE TABLE IF NOT EXISTS work_daily_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_project_id UUID REFERENCES work_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day_index INT NOT NULL, -- Day number in month (1-31)
    plan_cumulative DECIMAL NOT NULL DEFAULT 0, -- Rencana penanaman (cumulative)
    actual_cumulative DECIMAL DEFAULT 0, -- Realisasi penanaman (cumulative)
    plan_daily DECIMAL, -- Plan for this day only
    actual_daily DECIMAL, -- Actual for this day only
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (work_project_id, date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_daily_data_project ON work_daily_data(work_project_id);
CREATE INDEX IF NOT EXISTS idx_work_daily_data_date ON work_daily_data(date);

-- Comments for documentation
COMMENT ON TABLE work_projects IS 'Stores work project (fase) information for planting tracking';
COMMENT ON TABLE work_daily_data IS 'Stores daily planting data for S-curve visualization';
COMMENT ON COLUMN work_projects.productivity_target IS 'Target productivity in bibit/orang/day';
COMMENT ON COLUMN work_daily_data.plan_cumulative IS 'Cumulative planned planting (Rencana penanaman)';
COMMENT ON COLUMN work_daily_data.actual_cumulative IS 'Cumulative actual planting (Realisasi penanaman)';

-- Enable Row Level Security (RLS) - optional
-- ALTER TABLE work_projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE work_daily_data ENABLE ROW LEVEL SECURITY;
