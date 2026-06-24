-- Veriyo Submissions table: stores both repair reports and workshop listings
CREATE TABLE IF NOT EXISTS "Submissions" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Shared fields
    workshop_name text NOT NULL DEFAULT '',
    suburb text,
    city text,
    province text,
    status text DEFAULT 'Pending',

    -- Repair report fields
    car_make text,
    car_model text,
    car_year integer,
    repair_date date,
    repair_type text,
    part_description text,
    amount_paid numeric DEFAULT 0,
    rating integer DEFAULT 0,
    notes text,
    felt_overcharged boolean,
    felt_overcharged_reason text,
    staff_treatment text,
    staff_treatment_reason text,

    -- Workshop listing fields
    physical_address text,
    contact_number text,
    email_address text,
    operating_hours text,
    specialisation text,
    years_operation integer DEFAULT 0,
    rmi_registered text DEFAULT 'No',
    written_quote text DEFAULT 'No',
    guarantee_work text DEFAULT 'No',
    guarantee_period text,
    price_oil_change integer DEFAULT 0,
    price_minor_service integer DEFAULT 0,
    price_major_service integer DEFAULT 0,
    price_alignment integer DEFAULT 0,
    price_brake_pads integer DEFAULT 0,
    price_diagnostic integer DEFAULT 0,
    custom_service_name_1 text,
    custom_service_price_1 integer DEFAULT 0,
    custom_service_name_2 text,
    custom_service_price_2 integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE "Submissions" ENABLE ROW LEVEL SECURITY;

-- Public read access (prices page shows approved records to anonymous visitors)
CREATE POLICY "read_submissions" ON "Submissions"
    FOR SELECT TO anon, authenticated USING (true);

-- Public insert (motorists submit reports without logging in)
CREATE POLICY "insert_submissions" ON "Submissions"
    FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Authenticated update (admin dashboard approves/rejects)
CREATE POLICY "update_submissions" ON "Submissions"
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Index for the admin dashboard's pending query
CREATE INDEX IF NOT EXISTS submissions_status_idx ON "Submissions" (status);
