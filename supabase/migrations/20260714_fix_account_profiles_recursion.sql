-- The "select_all_account_types_admin" rule on account_profiles checks
-- account_profiles by looking inside account_profiles itself — a circular
-- check that Postgres refuses to run. Replacing it with the safe go-between
-- function (already created earlier) fixes the loop for good.

DROP POLICY IF EXISTS "select_all_account_types_admin" ON account_profiles;

CREATE POLICY "select_all_account_types_admin" ON account_profiles
FOR SELECT TO authenticated
USING (public.is_admin_user());
