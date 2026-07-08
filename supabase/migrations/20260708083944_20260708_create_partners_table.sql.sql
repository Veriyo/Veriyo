-- Partners table for marketing partners
CREATE TABLE IF NOT EXISTS partners (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- User reference (links to Supabase auth)
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Partner identification
    partner_code text NOT NULL UNIQUE,  -- e.g. 'VP-0001'
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    
    -- Status tracking
    status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Trial', 'Active', 'Inactive', 'Left')),
    trial_starts_at timestamptz,
    trial_ends_at timestamptz,
    trial_completed_at timestamptz,
    
    -- Referral tracking
    referral_code text NOT NULL UNIQUE,  -- e.g. 'VP-0001' used in URLs
    
    -- Statistics (denormalized for performance)
    total_visitors integer DEFAULT 0,
    total_motorist_submissions integer DEFAULT 0,
    total_workshop_signups integer DEFAULT 0,
    total_approved_workshops integer DEFAULT 0,
    total_conversions integer DEFAULT 0,
    
    -- Earnings tracking
    estimated_earnings numeric DEFAULT 0,
    
    -- Activity tracking
    last_active_at timestamptz,
    tasks_completed_today integer DEFAULT 0,
    weekly_completion_rate numeric DEFAULT 0,
    monthly_completion_rate numeric DEFAULT 0
);

-- Enable RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Partners can view their own record
CREATE POLICY "select_own_partner" ON partners
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admin can view all partners
CREATE POLICY "select_all_partners_admin" ON partners
    FOR SELECT TO authenticated USING (true);

-- Only service role or admin can insert/update
CREATE POLICY "insert_partners_admin" ON partners
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_partners_admin" ON partners
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_partners_user_id ON partners(user_id);
CREATE INDEX idx_partners_partner_code ON partners(partner_code);
CREATE INDEX idx_partners_status ON partners(status);

-- Function to auto-generate partner code
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS text AS $$
DECLARE
    next_num integer;
    new_code text;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(partner_code FROM 4) AS integer)), 0) + 1
    INTO next_num
    FROM partners;
    
    new_code := 'VP-' || LPAD(next_num::text, 4, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set updated_at
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partners_updated_at
    BEFORE UPDATE ON partners
    FOR EACH ROW
    EXECUTE FUNCTION update_partners_updated_at();
