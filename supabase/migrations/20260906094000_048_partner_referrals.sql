-- ============================================================================
-- AUDIT STEP 4 of N: partner_referrals (+ a real fix, not just a missing table)
-- ============================================================================
-- This one is more than a missing migration — it's a live bug. partner.js
-- reads today/week/month/all-time click counts from "partner_referrals",
-- and list-workshop.js marks a row's converted_status when a referred
-- visitor registers a workshop. But nothing anywhere INSERTS into
-- "partner_referrals" — the only Supabase function that records a partner
-- click (record_partner_visit, from the 20260714 migration) only writes to
-- the older "partner_visitors" table. So today:
--   - partner.js's click stats always read 0, for every partner.
--   - list-workshop.js's conversion UPDATE always matches zero rows and
--     silently does nothing (Supabase doesn't error on a no-op update).
-- "partner_visitors" is still the right table to keep as-is: admin.js
-- separately counts raw visits per partner from it, so nothing here removes
-- or changes it.
--
-- What this migration does:
--   1. Creates "partner_referrals" (CREATE TABLE IF NOT EXISTS — no-op if
--      it already exists), with a unique (partner_code, visitor_session_id)
--      so upserts and list-workshop.js's UPDATE can both target one row.
--   2. Adds RLS policies, each only created if missing.
--   3. Extends record_partner_visit() to ALSO upsert into
--      partner_referrals, keeping its existing partner_visitors insert
--      completely untouched. This is a CREATE OR REPLACE, deliberately —
--      the current body is quoted verbatim from the 20260714 migration, so
--      this is a verified extension, not a guess, and it's safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_referrals (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    partner_id bigint NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    partner_code text NOT NULL,
    visitor_session_id text NOT NULL,
    first_visit_at timestamptz NOT NULL DEFAULT now(),
    last_visit_at timestamptz NOT NULL DEFAULT now(),
    visit_count integer NOT NULL DEFAULT 1,
    converted_status text,
    CONSTRAINT uq_partner_referrals_code_visitor UNIQUE (partner_code, visitor_session_id)
);

ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_last_visit ON partner_referrals(last_visit_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_referrals' AND policyname = 'select_own_referrals'
    ) THEN
        CREATE POLICY "select_own_referrals" ON partner_referrals
            FOR SELECT TO authenticated USING (
                EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_referrals.partner_id AND partners.user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_referrals' AND policyname = 'select_all_referrals_admin'
    ) THEN
        CREATE POLICY "select_all_referrals_admin" ON partner_referrals
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_referrals' AND policyname = 'insert_referrals'
    ) THEN
        CREATE POLICY "insert_referrals" ON partner_referrals
            FOR INSERT TO anon, authenticated WITH CHECK (true);
    END IF;

    -- list-workshop.js updates converted_status straight from the client,
    -- matched only by partner_code + visitor_session_id (there's no user_id
    -- on the row to check against). This mirrors partner_visitors' own
    -- insert policy in staying permissive rather than silently no-op'ing on
    -- real workshop signups.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_referrals' AND policyname = 'update_referrals_conversion'
    ) THEN
        CREATE POLICY "update_referrals_conversion" ON partner_referrals
            FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Extends the existing function (body copied verbatim from the 20260714
-- migration below, then one INSERT added) so every referral click is
-- finally recorded in both tables.
CREATE OR REPLACE FUNCTION record_partner_visit(p_partner_code text, p_fingerprint text)
RETURNS void AS $$
DECLARE
    v_partner_id bigint;
BEGIN
    SELECT id INTO v_partner_id FROM partners WHERE partner_code = p_partner_code;
    IF v_partner_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO partner_visitors (partner_id, visitor_fingerprint)
    VALUES (v_partner_id, p_fingerprint);

    INSERT INTO partner_referrals (partner_id, partner_code, visitor_session_id, first_visit_at, last_visit_at, visit_count)
    VALUES (v_partner_id, p_partner_code, p_fingerprint, now(), now(), 1)
    ON CONFLICT (partner_code, visitor_session_id)
    DO UPDATE SET last_visit_at = now(), visit_count = partner_referrals.visit_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_partner_visit(text, text) TO anon, authenticated;
