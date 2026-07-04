-- =====================================================
-- Allow the user directory to be readable by any signed-in user.
--
-- The Coordination Hub recipient picker (fetchRecipients) lists other users by
-- full_name + role_code. The original user_profiles policy only let a user read
-- their OWN row, so the picker was always empty. This adds a permissive SELECT
-- policy so authenticated users can see the directory. Existing "read own
-- profile" policy stays (harmless; policies are OR'd).
--
-- Scope note: this exposes all user_profiles columns (incl. assigned_project_ids,
-- is_active) to every signed-in user. Acceptable for an internal team tool. For
-- stricter column scoping, replace with a SECURITY DEFINER function returning
-- only (user_id, full_name, role_code).
-- =====================================================

DROP POLICY IF EXISTS "Allow authenticated read profiles directory" ON user_profiles;
CREATE POLICY "Allow authenticated read profiles directory" ON user_profiles
    FOR SELECT TO authenticated
    USING (true);
