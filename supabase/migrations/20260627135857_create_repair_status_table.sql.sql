-- Create repair_status table for tracking repair job progress
CREATE TABLE IF NOT EXISTS repair_status (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    workshop_id BIGINT REFERENCES "Workshopprofiles"(id) ON DELETE SET NULL,
    motorist_session_id TEXT NOT NULL,
    car_make TEXT,
    car_model TEXT,
    repair_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received', 'Diagnosing', 'Parts Ordered', 'In Progress', 'Ready for Collection')),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE repair_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for repair_status table
CREATE POLICY "select_own_repairs" ON repair_status FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "insert_repairs" ON repair_status FOR INSERT
    TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_repairs" ON repair_status FOR UPDATE
    TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_repairs" ON repair_status FOR DELETE
    TO anon, authenticated USING (true);

-- Create index for faster lookups by session ID
CREATE INDEX IF NOT EXISTS idx_repair_status_motorist_session ON repair_status(motorist_session_id);

-- Create index for workshop lookups
CREATE INDEX IF NOT EXISTS idx_repair_status_workshop ON repair_status(workshop_id);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_repair_status_updated_at
    BEFORE UPDATE ON repair_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
