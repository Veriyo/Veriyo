-- ============================================================================
-- AUDIT STEP 1 of N: account_profiles + is_admin_user()
-- ============================================================================
-- account_profiles is read/written from auth.html, auth-guard.js/html,
-- prices.js, workshop-profile.js, welcome.html, motorist-home.html and
-- admin.js — it's the single most-used table in the whole codebase — yet no
-- migration file in this repo creates it. Same story for is_admin_user(),
-- the function admin-only RLS policies (including the one already in
-- 20260714_fix_account_profiles_recursion.sql) depend on.
--
-- Everything below is additive-only and safe to run against the live
-- project as-is:
--   - CREATE TABLE IF NOT EXISTS: does nothing if the table already exists.
--   - Each RLS policy is only created if a policy with that exact name is
--     missing — existing policies are never dropped or replaced, so this
--     cannot loosen or change your current production security rules.
--   - is_admin_user() is only created if no function with that name exists
--     yet, specifically so this migration can never silently overwrite the
--     real admin-check logic with a guessed version.
-- If your project already has all of this (it almost certainly does, since
-- the app works today), running this migration is a safe no-op.
-- ============================================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS account_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    account_type text NOT NULL CHECK (account_type IN ('motorist', 'workshop')),
    first_name text,
    last_name text,
    workshop_name text,
    referral_source text,
    is_admin boolean NOT NULL DEFAULT false
);

ALTER TABLE account_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Baseline self-access policies (each only created if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'account_profiles' AND policyname = 'select_own_profile'
    ) THEN
        CREATE POLICY "select_own_profile" ON account_profiles
            FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'account_profiles' AND policyname = 'insert_own_profile'
    ) THEN
        CREATE POLICY "insert_own_profile" ON account_profiles
            FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'account_profiles' AND policyname = 'update_own_profile'
    ) THEN
        CREATE POLICY "update_own_profile" ON account_profiles
            FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- 3. is_admin_user() — only created if truly missing (see warning above)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
    ) THEN
        CREATE FUNCTION public.is_admin_user()
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        AS $func$
            SELECT EXISTS (
                SELECT 1 FROM account_profiles
                WHERE account_profiles.user_id = auth.uid()
                AND account_profiles.is_admin = true
            );
        $func$;

        GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
    END IF;
END $$;
