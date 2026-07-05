-- Add fields for V1 Launch: user ownership, source tracking, claim workflow, and services

ALTER TABLE "Workshopprofiles"
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS physical_address text,
ADD COLUMN IF NOT EXISTS years_operation integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_quote text DEFAULT 'No',
ADD COLUMN IF NOT EXISTS guarantee_work text DEFAULT 'No',
ADD COLUMN IF NOT EXISTS guarantee_period text,
ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'Dominant',
ADD COLUMN IF NOT EXISTS plan_price integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'Workshop Registered';

-- Source values: 'Imported by Veriyo', 'Workshop Registered', 'Claimed by Workshop'
-- Status values: 'Draft', 'Pending', 'Approved', 'Rejected', 'Suspended', 'Claim Pending'

CREATE INDEX IF NOT EXISTS workshopprofiles_user_id_idx ON "Workshopprofiles" (user_id);
CREATE INDEX IF NOT EXISTS workshopprofiles_source_idx ON "Workshopprofiles" (source);

-- Claim requests table
CREATE TABLE IF NOT EXISTS claim_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    workshop_id bigint NOT NULL REFERENCES "Workshopprofiles"(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_person text NOT NULL,
    role text,
    business_phone text,
    signboard_photo_url text,
    interior_photo_url text,
    document_url text,
    notes text,
    status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

ALTER TABLE claim_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated can insert claims
CREATE POLICY "insert_claim_requests" ON claim_requests
    FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated can view own claims
CREATE POLICY "select_own_claim_requests" ON claim_requests
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin (authenticated) can view all claims
CREATE POLICY "select_all_claim_requests" ON claim_requests
    FOR SELECT TO authenticated USING (true);

-- Admin can update claims
CREATE POLICY "update_claim_requests" ON claim_requests
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS claim_requests_workshop_id_idx ON claim_requests (workshop_id);
CREATE INDEX IF NOT EXISTS claim_requests_user_id_idx ON claim_requests (user_id);