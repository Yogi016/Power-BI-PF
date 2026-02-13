-- Add DELETE policies so client-side replace operations (delete + insert) can run under anon role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Allow public delete on projects'
  ) THEN
    CREATE POLICY "Allow public delete on projects" ON projects FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activities' AND policyname = 'Allow public delete on activities'
  ) THEN
    CREATE POLICY "Allow public delete on activities" ON activities FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'weekly_progress' AND policyname = 'Allow public delete on weekly_progress'
  ) THEN
    CREATE POLICY "Allow public delete on weekly_progress" ON weekly_progress FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monthly_progress' AND policyname = 'Allow public delete on monthly_progress'
  ) THEN
    CREATE POLICY "Allow public delete on monthly_progress" ON monthly_progress FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 's_curve_baseline' AND policyname = 'Allow public delete on s_curve_baseline'
  ) THEN
    CREATE POLICY "Allow public delete on s_curve_baseline" ON s_curve_baseline FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 's_curve_actual' AND policyname = 'Allow public delete on s_curve_actual'
  ) THEN
    CREATE POLICY "Allow public delete on s_curve_actual" ON s_curve_actual FOR DELETE USING (true);
  END IF;
END;
$$;
