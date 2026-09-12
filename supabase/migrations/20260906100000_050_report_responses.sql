-- ============================================================================
-- AUDIT STEP 6 of N: report_responses
-- ============================================================================
-- prices.js reads report_responses to show a workshop's reply under a price
-- report, and upserts into it (one response per submission_id, plan-gated
-- to Growth/Premium workshops in the app UI) when a workshop owner submits
-- one. No migration file creates this table.
--
-- Ownership follows the same Workshopprofiles.user_id = auth.uid() pattern
-- already used for chats/workshop plan checks elsewhere in this app.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_responses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    submission_id bigint NOT NULL UNIQUE REFERENCES "Submissions"(id) ON DELETE CASCADE,
    workshop_id bigint NOT NULL REFERENCES "Workshopprofiles"(id) ON DELETE CASCADE,
    response_text text NOT NULL
);

ALTER TABLE report_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS report_responses_workshop_id_idx ON report_responses (workshop_id);

DO $$
BEGIN
    -- Responses are shown publicly next to the report on the Prices page
    -- (any visitor, logged in or not, can see a workshop's reply).
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_responses' AND policyname = 'select_report_responses_public'
    ) THEN
        CREATE POLICY "select_report_responses_public" ON report_responses
            FOR SELECT TO anon, authenticated USING (true);
    END IF;

    -- Only the workshop the report is actually about can write/upsert its
    -- own response.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_responses' AND policyname = 'insert_own_report_response'
    ) THEN
        CREATE POLICY "insert_own_report_response" ON report_responses
            FOR INSERT TO authenticated WITH CHECK (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            );
    END IF;

    -- Needed for prices.js's .upsert(...) — an upsert on a conflicting
    -- submission_id is an UPDATE under the hood.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_responses' AND policyname = 'update_own_report_response'
    ) THEN
        CREATE POLICY "update_own_report_response" ON report_responses
            FOR UPDATE TO authenticated USING (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            ) WITH CHECK (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            );
    END IF;
END $$;
