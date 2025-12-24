-- Migration: Add work_plan_schedule table
-- This table stores the planned daily targets for each work project

CREATE TABLE IF NOT EXISTS work_plan_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  date DATE NOT NULL,
  daily_target INTEGER NOT NULL DEFAULT 0,
  weight DECIMAL(5,2) NOT NULL DEFAULT 0,
  plan_cumulative INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(work_project_id, day_index)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_work_plan_schedule_project ON work_plan_schedule(work_project_id);

-- Enable RLS (optional)
ALTER TABLE work_plan_schedule ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all operations on work_plan_schedule" ON work_plan_schedule
  FOR ALL USING (true) WITH CHECK (true);
