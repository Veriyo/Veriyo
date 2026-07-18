-- Insert default partner tasks
INSERT INTO partner_tasks (title, description, why_matters, expected_outcome, sort_order, is_active) VALUES
(
    'Share the referral link in community groups',
    'Post your unique Veriyo referral link in community WhatsApp groups, Facebook groups, or other social platforms where motorists gather.',
    'This is how potential users discover Veriyo through your network. Each person who clicks your link is tracked to your account.',
    'At least 3-5 community groups reached daily. Track how many clicks your link receives.',
    1,
    true
),
(
    'Introduce Veriyo to motorists',
    'Have conversations with motorists about Veriyo. Explain how it helps them find fair prices and trusted workshops.',
    'Personal recommendations build trust. Motorists who understand Veriyo''s purpose are more likely to use the platform.',
    '3-5 meaningful conversations where you explained Veriyo to a motorist.',
    2,
    true
),
(
    'Answer questions from interested motorists',
    'When motorists ask questions about Veriyo, respond helpfully and accurately. If you don''t know the answer, note it down.',
    'Quick, accurate answers convert curious visitors into active users. Poor responses drive people away.',
    'All questions answered satisfactorily. Note any questions you couldn''t answer.',
    3,
    true
),
(
    'Encourage motorists to submit repair prices',
    'Ask motorists who have had repairs done to share their experiences on Veriyo. Show them the Prices page.',
    'Price submissions build our database and help other motorists make informed decisions. This is core to Veriyo''s mission.',
    'At least 1 motorist encouraged to submit a repair price report.',
    4,
    true
),
(
    'Encourage motorists to compare workshops',
    'Before motorists commit to repairs, suggest they compare workshops on Veriyo to find fair pricing.',
    'This demonstrates Veriyo''s value in real-time and can lead to instant conversions.',
    'At least 1 motorist advised to compare workshops before their next repair.',
    5,
    true
);
-- Referral tracking: make Total Clicks and Conversions on the Partner
-- Portal actually reflect real activity instead of sitting at 0 forever.

-- 1. referral_source didn't exist on either submission-style table yet,
--    even though forms.js already tries to write it on report submissions.
--    Safe no-ops if a column with this name is already there.
ALTER TABLE "Submissions" ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE "Workshopprofiles" ADD COLUMN IF NOT EXISTS referral_source text;

-- 2. One row per (partner, visitor) so repeat page loads from the same
--    person update visit_count instead of creating a new row each time —
--    Total Clicks (a row count) then reflects unique visitors, not raw
--    page loads.
ALTER TABLE partner_visitors
    ADD CONSTRAINT uq_partner_visitor UNIQUE (partner_id, visitor_fingerprint);

-- 3. RPC the client calls to record a visit. SECURITY DEFINER so an
--    anonymous visitor (not logged in — the normal case for someone who
--    just clicked a referral link) can still trigger this, without needing
--    open read/write access to the partners or partner_visitors tables.
CREATE OR REPLACE FUNCTION record_partner_visit(p_partner_code text, p_fingerprint text)
RETURNS void AS $$
DECLARE
    v_partner_id bigint;
BEGIN
    SELECT id INTO v_partner_id FROM partners WHERE partner_code = p_partner_code;
    IF v_partner_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO partner_visitors (partner_id, visitor_fingerprint)
    VALUES (v_partner_id, p_fingerprint)
    ON CONFLICT (partner_id, visitor_fingerprint) DO UPDATE
        SET last_visit_at = now(),
            visit_count = partner_visitors.visit_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_partner_visit(text, text) TO anon, authenticated;

-- 4. Credit a partner when a motorist report carries their referral_source.
CREATE OR REPLACE FUNCTION credit_partner_motorist_submission()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_source IS NOT NULL THEN
        UPDATE partners
        SET total_motorist_submissions = total_motorist_submissions + 1,
            total_conversions = total_conversions + 1
        WHERE partner_code = NEW.referral_source;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_partner_motorist_submission ON "Submissions";
CREATE TRIGGER trg_credit_partner_motorist_submission
    AFTER INSERT ON "Submissions"
    FOR EACH ROW
    EXECUTE FUNCTION credit_partner_motorist_submission();

-- 5. Credit a partner when a workshop registers with their referral_source.
CREATE OR REPLACE FUNCTION credit_partner_workshop_signup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_source IS NOT NULL THEN
        UPDATE partners
        SET total_workshop_signups = total_workshop_signups + 1,
            total_conversions = total_conversions + 1
        WHERE partner_code = NEW.referral_source;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_partner_workshop_signup ON "Workshopprofiles";
CREATE TRIGGER trg_credit_partner_workshop_signup
    AFTER INSERT ON "Workshopprofiles"
    FOR EACH ROW
    EXECUTE FUNCTION credit_partner_workshop_signup();

-- 6. Credit a partner when a workshop with their referral_source gets
--    approved — only fires on the transition INTO Approved, not on every
--    subsequent edit while it stays approved.
CREATE OR REPLACE FUNCTION credit_partner_workshop_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_source IS NOT NULL
        AND NEW.status = 'Approved'
        AND (OLD.status IS DISTINCT FROM 'Approved') THEN
        UPDATE partners
        SET total_approved_workshops = total_approved_workshops + 1,
            total_conversions = total_conversions + 1
        WHERE partner_code = NEW.referral_source;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_credit_partner_workshop_approval ON "Workshopprofiles";
CREATE TRIGGER trg_credit_partner_workshop_approval
    AFTER UPDATE ON "Workshopprofiles"
    FOR EACH ROW
    EXECUTE FUNCTION credit_partner_workshop_approval();
