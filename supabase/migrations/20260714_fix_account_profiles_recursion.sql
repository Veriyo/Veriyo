-- The "select_all_account_types_admin" rule on account_profiles checks
-- account_profiles by looking inside account_profiles itself — a circular
-- check that Postgres refuses to run. Replacing it with the safe go-between
-- function (already created earlier) fixes the loop for good.

DROP POLICY IF EXISTS "select_all_account_types_admin" ON account_profiles;

CREATE POLICY "select_all_account_types_admin" ON account_profiles
FOR SELECT TO authenticated
USING (public.is_admin_user());

CREATE POLICY "Allow admin to delete submissions" ON "Submissions"
FOR DELETE TO authenticated
USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.get_account_display_names(target_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_profiles.user_id,
         NULLIF(TRIM(CONCAT_WS(' ', account_profiles.first_name, account_profiles.last_name)), '') AS display_name
  FROM account_profiles
  WHERE account_profiles.user_id = ANY(target_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_account_display_names(uuid[]) TO authenticated;
-- Refine referral tracking: clicks are now only ever called on genuine
-- click-throughs (see updated referral.js), so recording no longer needs
-- to dedupe by visitor. And "conversion" should only reflect something
-- the referred person themselves did, not an admin's later approval.

-- 1. Plain insert per click — no more upsert/dedupe needed.
DROP FUNCTION IF EXISTS record_partner_visit(text, text);
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
    VALUES (v_partner_id, p_fingerprint);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_partner_visit(text, text) TO anon, authenticated;

-- 2. Drop the unique constraint from the previous migration — clicks are
--    no longer deduped per visitor, so it no longer applies.
ALTER TABLE partner_visitors DROP CONSTRAINT IF EXISTS uq_partner_visitor;

-- 3. Workshop approval still counts toward total_approved_workshops, but
--    no longer bumps total_conversions — approval is an admin action, not
--    something the referred person did.
CREATE OR REPLACE FUNCTION credit_partner_workshop_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_source IS NOT NULL
        AND NEW.status = 'Approved'
        AND (OLD.status IS DISTINCT FROM 'Approved') THEN
        UPDATE partners
        SET total_approved_workshops = total_approved_workshops + 1
        WHERE partner_code = NEW.referral_source;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- credit_partner_motorist_submission() and credit_partner_workshop_signup()
-- from the previous migration are unchanged — they already only fire on
-- the referred person's own submit/register action, which is exactly
-- what "conversion" should mean now.
