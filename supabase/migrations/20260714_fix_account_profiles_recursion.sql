-- The "select_all_account_types_admin" rule on account_profiles checks
-- account_profiles by looking inside account_profiles itself — a circular
-- check that Postgres refuses to run. Replacing it with the safe go-between
-- function (already created earlier) fixes the loop for good.

DROP POLICY IF EXISTS "select_all_account_types_admin" ON account_profiles;

CREATE POLICY "select_all_account_types_admin" ON account_profiles
FOR SELECT TO authenticated
USING (public.is_admin_user());

CREATE POLICY "Allow admin to delete submissions" ON "Submissions"
FOR DELETE TO authenticated
USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.get_account_display_names(target_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_profiles.user_id,
         NULLIF(TRIM(CONCAT_WS(' ', account_profiles.first_name, account_profiles.last_name)), '') AS display_name
  FROM account_profiles
  WHERE account_profiles.user_id = ANY(target_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_account_display_names(uuid[]) TO authenticated;
