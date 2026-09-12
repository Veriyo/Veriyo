-- ============================================================================
-- AUDIT STEP 8 of N: workshop_claims
-- ============================================================================
-- prices.js inserts into "workshop_claims" from the "Is this your workshop?
-- Claim this listing" modal on the Prices page (anonymous — just a name,
-- contact email, optional message, status defaulting to Pending). admin.js
-- reviews and approves/rejects these in the "Quick Claims" panel. No
-- migration file creates this table.
--
-- This is a different, simpler flow from "claim_requests" (which already
-- has its own migration and is used by claim-workshop.js's fuller
-- claim-with-evidence flow) — the two are genuinely separate tables in the
-- code, not a naming drift, so both are kept as-is.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
--   - Depends on public.is_admin_user() from audit step 1.
-- ============================================================================

CREATE TABLE IF NOT EXISTS workshop_claims (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    workshop_name text NOT NULL,
    contact_email text NOT NULL,
    message text,
    status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

ALTER TABLE workshop_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Anyone can submit a quick claim — the modal doesn't require login.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workshop_claims' AND policyname = 'insert_workshop_claims'
    ) THEN
        CREATE POLICY "insert_workshop_claims" ON workshop_claims
            FOR INSERT TO anon, authenticated WITH CHECK (true);
    END IF;

    -- Only the admin dashboard's Quick Claims panel reads/reviews these.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workshop_claims' AND policyname = 'select_workshop_claims_admin'
    ) THEN
        CREATE POLICY "select_workshop_claims_admin" ON workshop_claims
            FOR SELECT TO authenticated USING (public.is_admin_user());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workshop_claims' AND policyname = 'update_workshop_claims_admin'
    ) THEN
        CREATE POLICY "update_workshop_claims_admin" ON workshop_claims
            FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
    END IF;
END $$;
