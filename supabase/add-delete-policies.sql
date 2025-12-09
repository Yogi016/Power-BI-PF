-- =====================================================
-- ADD DELETE POLICIES FOR ALL TABLES
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- Policy: Allow public delete on projects
CREATE POLICY "Allow public delete on projects" ON projects FOR DELETE USING (true);

-- Policy: Allow public delete on activities
CREATE POLICY "Allow public delete on activities" ON activities FOR DELETE USING (true);

-- Policy: Allow public delete on weekly_progress
CREATE POLICY "Allow public delete on weekly_progress" ON weekly_progress FOR DELETE USING (true);

-- Policy: Allow public delete on monthly_progress
CREATE POLICY "Allow public delete on monthly_progress" ON monthly_progress FOR DELETE USING (true);

-- Policy: Allow public delete on s_curve_baseline
CREATE POLICY "Allow public delete on s_curve_baseline" ON s_curve_baseline FOR DELETE USING (true);

-- Policy: Allow public delete on s_curve_actual
CREATE POLICY "Allow public delete on s_curve_actual" ON s_curve_actual FOR DELETE USING (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check all policies for projects table:
-- SELECT * FROM pg_policies WHERE tablename = 'projects';
