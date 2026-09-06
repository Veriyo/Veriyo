-- Recent Activity on the motorist homepage has always shown a static
-- "nothing to show yet" placeholder because Submissions was never linked
-- back to the motorist who filed it. Adding an optional user_id lets us
-- look up "my own reports" without touching the anonymous-submission flow
-- (the column stays null for anyone who reports while signed out).

ALTER TABLE "Submissions"
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON "Submissions" (user_id);
