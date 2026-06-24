-- Workshopprofiles table for verified workshop directory
CREATE TABLE IF NOT EXISTS "Workshopprofiles" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    workshop_name text NOT NULL DEFAULT '',
    suburb text,
    city text,
    province text,
    status text DEFAULT 'Pending',
    specialisation text,
    rmi_registered text DEFAULT 'No',
    contact_number text,
    email_address text,
    operating_hours text
);

ALTER TABLE "Workshopprofiles" ENABLE ROW LEVEL SECURITY;

-- Public read (directory visible to anonymous visitors)
CREATE POLICY "read_workshopprofiles" ON "Workshopprofiles"
    FOR SELECT TO anon, authenticated USING (true);

-- Authenticated insert (admin/staff create listings)
CREATE POLICY "insert_workshopprofiles" ON "Workshopprofiles"
    FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated update (admin moderates status)
CREATE POLICY "update_workshopprofiles" ON "Workshopprofiles"
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS workshopprofiles_status_idx ON "Workshopprofiles" (status);
