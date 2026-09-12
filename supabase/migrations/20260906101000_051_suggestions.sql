-- ============================================================================
-- AUDIT STEP 7 of N: suggestions
-- ============================================================================
-- motorist-home.html's "Suggest an Improvement" box inserts into
-- "suggestions" (just free text, no user_id — it's anonymous feedback), and
-- admin.js reads it all back in the admin dashboard's suggestions panel. No
-- migration file creates this table.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
--   - Depends on public.is_admin_user() from audit step 1.
-- ============================================================================

CREATE TABLE IF NOT EXISTS suggestions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    suggestion_text text NOT NULL
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- The feedback box on motorist-home.html never reads suggestions back,
    -- and doesn't record who submitted one, so this stays a write-only box
    -- from the visitor's side — matching Submissions' own anon-friendly
    -- insert policy elsewhere in this app.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suggestions' AND policyname = 'insert_suggestions'
    ) THEN
        CREATE POLICY "insert_suggestions" ON suggestions
            FOR INSERT TO anon, authenticated WITH CHECK (true);
    END IF;

    -- Only the admin dashboard's suggestions panel ever reads these back.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suggestions' AND policyname = 'select_suggestions_admin'
    ) THEN
        CREATE POLICY "select_suggestions_admin" ON suggestions
            FOR SELECT TO authenticated USING (public.is_admin_user());
    END IF;
END $$;
