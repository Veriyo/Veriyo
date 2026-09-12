-- ============================================================================
-- AUDIT STEP 5 of N: premium_waitlist
-- ============================================================================
-- admin.js upserts into "premium_waitlist" (workshop_id, suburb) when an
-- admin tries to set a workshop to the Dominant/Premium plan and the DB
-- rejects it because that suburb's 3 Premium slots are already taken. No
-- migration file creates this table, so a fresh project would be missing it.
--
-- This is admin-only in every reference I found in the codebase (no
-- motorist- or workshop-facing code touches it), so unlike the more
-- permissive tables in earlier steps, this one is locked down to
-- is_admin_user() for both read and write.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
--   - Depends on public.is_admin_user() from audit step 1.
--
-- IMPORTANT — flagging, not fixing, a bigger related gap: admin.js's own
-- comment says "The DB enforces the 3-per-suburb Premium cap and rejects
-- the write with this message [Premium slots are full]" — but I can't find
-- that trigger/constraint in any migration either. Either it was created
-- directly in the Supabase dashboard and never captured, or it doesn't
-- actually exist yet and admins can currently oversell Premium in a
-- suburb with no limit. I'm deliberately NOT guessing that trigger into
-- existence in this step — recreating a business-rule trigger blind risks
-- double-firing against a same-purpose trigger that already exists under a
-- different name, or getting the cap logic subtly wrong. Let me know if you
-- want to tackle that one next and, if you can, confirm whether the cap
-- currently works for you in the live admin dashboard today.
-- ============================================================================

CREATE TABLE IF NOT EXISTS premium_waitlist (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    workshop_id bigint NOT NULL UNIQUE REFERENCES "Workshopprofiles"(id) ON DELETE CASCADE,
    suburb text NOT NULL
);

ALTER TABLE premium_waitlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'premium_waitlist' AND policyname = 'select_premium_waitlist_admin'
    ) THEN
        CREATE POLICY "select_premium_waitlist_admin" ON premium_waitlist
            FOR SELECT TO authenticated USING (public.is_admin_user());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'premium_waitlist' AND policyname = 'insert_premium_waitlist_admin'
    ) THEN
        CREATE POLICY "insert_premium_waitlist_admin" ON premium_waitlist
            FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
    END IF;

    -- Needed for admin.js's .upsert(...) — an upsert on a conflicting row
    -- is an UPDATE under the hood.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'premium_waitlist' AND policyname = 'update_premium_waitlist_admin'
    ) THEN
        CREATE POLICY "update_premium_waitlist_admin" ON premium_waitlist
            FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
    END IF;
END $$;
