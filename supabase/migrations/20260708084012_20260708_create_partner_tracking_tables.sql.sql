-- Partner referral visitors tracking
CREATE TABLE IF NOT EXISTS partner_visitors (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Which partner's referral
    partner_id bigint NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    
    -- Visitor identification (anonymized)
    visitor_fingerprint text NOT NULL,  -- Hashed browser fingerprint
    
    -- Tracking
    first_visit_at timestamptz NOT NULL DEFAULT now(),
    last_visit_at timestamptz NOT NULL DEFAULT now(),
    visit_count integer DEFAULT 1,
    
    -- Conversion tracking
    submitted_motorist_report boolean DEFAULT false,
    registered_workshop boolean DEFAULT false,
    workshop_approved boolean DEFAULT false,
    started_chat boolean DEFAULT false,
    
    -- Source info
    ip_city text,
    ip_region text
);

ALTER TABLE partner_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_visitors" ON partner_visitors
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_visitors.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "select_all_visitors_admin" ON partner_visitors
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_visitors" ON partner_visitors
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX idx_partner_visitors_partner ON partner_visitors(partner_id);
CREATE INDEX idx_partner_visitors_fingerprint ON partner_visitors(visitor_fingerprint);


-- Partner daily tasks
CREATE TABLE IF NOT EXISTS partner_tasks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Task content
    title text NOT NULL,
    description text NOT NULL,
    why_matters text NOT NULL,
    expected_outcome text NOT NULL,
    
    -- Ordering and status
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true
);

ALTER TABLE partner_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_partner_tasks" ON partner_tasks
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "admin_partner_tasks" ON partner_tasks
    FOR ALL TO authenticated USING (true);


-- Partner task completions
CREATE TABLE IF NOT EXISTS partner_task_completions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    partner_id bigint NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES partner_tasks(id) ON DELETE CASCADE,
    
    -- When completed
    completed_at timestamptz NOT NULL DEFAULT now(),
    completion_date date NOT NULL DEFAULT CURRENT_DATE,
    
    -- Unique constraint: one completion per task per partner per day
    CONSTRAINT unique_task_completion UNIQUE (partner_id, task_id, completion_date)
);

ALTER TABLE partner_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_completions" ON partner_task_completions
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_task_completions.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "insert_own_completions" ON partner_task_completions
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_task_completions.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "admin_completions" ON partner_task_completions
    FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_task_completions_partner ON partner_task_completions(partner_id);
CREATE INDEX idx_task_completions_date ON partner_task_completions(completion_date);


-- Partner daily activity reports
CREATE TABLE IF NOT EXISTS partner_activity_reports (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    partner_id bigint NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    report_date date NOT NULL DEFAULT CURRENT_DATE,
    
    -- Report fields
    groups_reached integer DEFAULT 0,
    estimated_people_reached integer DEFAULT 0,
    conversations_started integer DEFAULT 0,
    questions_received integer DEFAULT 0,
    interesting_feedback text,
    problems_encountered text,
    motorist_ideas text,
    additional_notes text,
    
    -- One report per partner per day
    CONSTRAINT unique_daily_report UNIQUE (partner_id, report_date)
);

ALTER TABLE partner_activity_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_reports" ON partner_activity_reports
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_activity_reports.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "insert_own_reports" ON partner_activity_reports
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_activity_reports.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "admin_reports" ON partner_activity_reports
    FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_activity_reports_partner ON partner_activity_reports(partner_id);
CREATE INDEX idx_activity_reports_date ON partner_activity_reports(report_date);


-- Partner announcements (from admin to all partners)
CREATE TABLE IF NOT EXISTS partner_announcements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    title text NOT NULL,
    message text NOT NULL,
    
    is_active boolean DEFAULT true
);

ALTER TABLE partner_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_announcements" ON partner_announcements
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "admin_announcements" ON partner_announcements
    FOR ALL TO authenticated USING (true);


-- Track which announcements a partner has read
CREATE TABLE IF NOT EXISTS partner_announcement_reads (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    partner_id bigint NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    announcement_id bigint NOT NULL REFERENCES partner_announcements(id) ON DELETE CASCADE,
    
    CONSTRAINT unique_announcement_read UNIQUE (partner_id, announcement_id)
);

ALTER TABLE partner_announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_reads" ON partner_announcement_reads
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_announcement_reads.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "insert_own_reads" ON partner_announcement_reads
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_announcement_reads.partner_id AND partners.user_id = auth.uid())
    );


-- Partner support requests
CREATE TABLE IF NOT EXISTS partner_support_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    partner_id bigint NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    
    subject text NOT NULL,
    message text NOT NULL,
    
    status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    admin_response text,
    responded_at timestamptz,
    responded_by uuid REFERENCES auth.users(id)
);

ALTER TABLE partner_support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_support" ON partner_support_requests
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_support_requests.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "insert_own_support" ON partner_support_requests
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM partners WHERE partners.id = partner_support_requests.partner_id AND partners.user_id = auth.uid())
    );

CREATE POLICY "admin_support" ON partner_support_requests
    FOR ALL TO authenticated USING (true);

CREATE INDEX idx_support_partner ON partner_support_requests(partner_id);
CREATE INDEX idx_support_status ON partner_support_requests(status);
