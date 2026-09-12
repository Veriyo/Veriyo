-- ============================================================================
-- AUDIT STEP 9 of N (last one): workshop_notifications
-- ============================================================================
-- auth.js's bell icon reads from "workshop_notifications" (scoped to the
-- signed-in workshop owner's own workshop_id) and marks a notification
-- read on click. No migration file creates this table.
--
-- This closes the loop on the drift flagged back in audit step 3: nothing
-- in the entire codebase ever INSERTs into "workshop_notifications" — only
-- auth.js's SELECT and UPDATE touch it. Meanwhile admin.js inserts
-- workshop-approval/removal notifications into a different table plainly
-- named "notifications", which nothing ever reads. Between the two, this is
-- now fairly convincing evidence that admin.js's inserts were meant to land
-- here — the bell has likely always shown "No notifications yet" in
-- production regardless of how many listings admin.js has approved or
-- removed. I'm not silently repointing admin.js to this table myself since
-- that's an application-code change, not a schema one, and you may want to
-- confirm this reading before anything gets swapped over — but this is the
-- clearest lead in the whole audit, so flagging it plainly here.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS workshop_notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    workshop_id bigint NOT NULL REFERENCES "Workshopprofiles"(id) ON DELETE CASCADE,
    submission_id bigint REFERENCES "Submissions"(id) ON DELETE CASCADE,
    type text NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false
);

ALTER TABLE workshop_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS workshop_notifications_workshop_id_idx ON workshop_notifications (workshop_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workshop_notifications' AND policyname = 'select_own_workshop_notifications'
    ) THEN
        CREATE POLICY "select_own_workshop_notifications" ON workshop_notifications
            FOR SELECT TO authenticated USING (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            );
    END IF;

    -- Needed for the bell's "mark as read on click" update.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workshop_notifications' AND policyname = 'update_own_workshop_notifications'
    ) THEN
        CREATE POLICY "update_own_workshop_notifications" ON workshop_notifications
            FOR UPDATE TO authenticated USING (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            ) WITH CHECK (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            );
    END IF;

    -- Left permissive rather than admin-only, mirroring "notifications"
    -- (step 3) — whichever code path ends up writing here (admin.js, once
    -- pointed at the right table, and/or a future chat-lock notice) isn't
    -- blocked by this migration guessing the wrong writer.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workshop_notifications' AND policyname = 'insert_workshop_notifications'
    ) THEN
        CREATE POLICY "insert_workshop_notifications" ON workshop_notifications
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;
