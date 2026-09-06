-- ============================================================================
-- AUDIT STEP 3 of N: notifications
-- ============================================================================
-- admin.js writes to "notifications" whenever a workshop listing is
-- approved or removed (workshop_id + user_id + message [+ link]). No
-- migration file creates it.
--
-- Heads up — this one looks like it may be a naming-drift bug, not just a
-- missing migration: nothing anywhere in the codebase ever reads from
-- "notifications". The bell icon that actually renders on-screen
-- notifications (auth.js) reads from a *different* table,
-- "workshop_notifications" (audit step 5), which has its own is_read
-- column and its own gap in the migrations. It's possible admin.js meant to
-- write to workshop_notifications all along. I'm creating "notifications"
-- here as its own real table, matching exactly what admin.js currently
-- inserts, since that's the safe schema-only fix — but you may want to
-- double check with whoever wrote admin.js whether it should instead be
-- writing to workshop_notifications so the bell icon actually picks it up.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workshop_id bigint REFERENCES "Workshopprofiles"(id) ON DELETE CASCADE,
    message text NOT NULL,
    link text,
    is_read boolean NOT NULL DEFAULT false
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);

DO $$
BEGIN
    -- A person can see their own notifications (nothing reads this today,
    -- but the policy is here so a future bell/inbox UI isn't blocked by RLS).
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'select_own_notifications'
    ) THEN
        CREATE POLICY "select_own_notifications" ON notifications
            FOR SELECT TO authenticated USING (user_id = auth.uid());
    END IF;

    -- A person can mark their own notifications read, for the same reason.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'update_own_notifications'
    ) THEN
        CREATE POLICY "update_own_notifications" ON notifications
            FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    END IF;

    -- Insert is left as broadly permissive as Submissions/Workshopprofiles
    -- elsewhere in this app (admin.js is the only writer today, and the app
    -- doesn't currently gate admin actions at the DB level except where the
    -- 20260714 migration already does so for account_profiles).
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'insert_notifications'
    ) THEN
        CREATE POLICY "insert_notifications" ON notifications
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;
