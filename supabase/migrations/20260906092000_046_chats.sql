-- ============================================================================
-- AUDIT STEP 2 of N: chats
-- ============================================================================
-- "chats" is one polymorphic table serving two unrelated conversations:
--   1. Motorist <-> Workshop  (chat.js)         — workshop_id + motorist_id
--   2. Partner  <-> Admin     (partner-chat.js) — partner_id
-- No migration file creates it, so a fresh project would be missing it
-- entirely even though it's used across chat.js, partner-chat.js, partner.js,
-- workshop-home.js and auth.js's unread-message dot.
--
-- Safe to run as-is:
--   - CREATE TABLE IF NOT EXISTS: no-op if it already exists.
--   - Every policy is only created if a policy with that exact name is
--     missing, so this can't change or loosen existing production rules.
--   - Depends on public.is_admin_user() from audit step 1 — run that
--     migration first if you haven't already.
-- ============================================================================

CREATE TABLE IF NOT EXISTS chats (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Set together for a motorist<->workshop thread; both null for a
    -- partner<->admin thread.
    workshop_id bigint REFERENCES "Workshopprofiles"(id) ON DELETE CASCADE,
    motorist_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Set for a partner<->admin thread; null for motorist<->workshop.
    partner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

    sender text NOT NULL CHECK (sender IN ('motorist', 'workshop', 'partner', 'admin')),
    message_text text NOT NULL
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS chats_workshop_id_idx ON chats (workshop_id);
CREATE INDEX IF NOT EXISTS chats_motorist_id_idx ON chats (motorist_id);
CREATE INDEX IF NOT EXISTS chats_partner_id_idx ON chats (partner_id);

DO $$
BEGIN
    -- Motorist: own side of any motorist<->workshop thread
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'select_own_motorist_chats'
    ) THEN
        CREATE POLICY "select_own_motorist_chats" ON chats
            FOR SELECT TO authenticated USING (motorist_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'insert_own_motorist_chats'
    ) THEN
        CREATE POLICY "insert_own_motorist_chats" ON chats
            FOR INSERT TO authenticated WITH CHECK (sender = 'motorist' AND motorist_id = auth.uid());
    END IF;

    -- Workshop owner: own side of any motorist<->workshop thread for a
    -- workshop they own (matched via Workshopprofiles.user_id).
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'select_own_workshop_chats'
    ) THEN
        CREATE POLICY "select_own_workshop_chats" ON chats
            FOR SELECT TO authenticated USING (
                workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'insert_own_workshop_chats'
    ) THEN
        CREATE POLICY "insert_own_workshop_chats" ON chats
            FOR INSERT TO authenticated WITH CHECK (
                sender = 'workshop' AND workshop_id IN (SELECT id FROM "Workshopprofiles" WHERE user_id = auth.uid())
            );
    END IF;

    -- Partner: own side of their thread with admin
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'select_own_partner_chats'
    ) THEN
        CREATE POLICY "select_own_partner_chats" ON chats
            FOR SELECT TO authenticated USING (partner_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'insert_own_partner_chats'
    ) THEN
        CREATE POLICY "insert_own_partner_chats" ON chats
            FOR INSERT TO authenticated WITH CHECK (sender = 'partner' AND partner_id = auth.uid());
    END IF;

    -- Admin: reads every partner thread (partner-chat.js's admin view lists
    -- all partners' conversations) and replies as 'admin' into any of them.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'select_all_chats_admin'
    ) THEN
        CREATE POLICY "select_all_chats_admin" ON chats
            FOR SELECT TO authenticated USING (public.is_admin_user());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chats' AND policyname = 'insert_admin_chats'
    ) THEN
        CREATE POLICY "insert_admin_chats" ON chats
            FOR INSERT TO authenticated WITH CHECK (sender = 'admin' AND public.is_admin_user());
    END IF;
END $$;

-- chat.js and partner-chat.js both subscribe to postgres_changes on this
-- table for live message delivery, which requires it to be part of the
-- supabase_realtime publication. Only added if it isn't already a member.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chats;
    END IF;
END $$;
