/**
 * Veriyo | Referral visit tracking
 * Records a visit against a partner when someone arrives via their
 * referral link, so Total Clicks on the Partner Portal reflects reality.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _sbRef = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Same localStorage key/format forms.js already reads when a motorist
    // submits a report, so both stay in sync on one referral value.
    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (refParam) localStorage.setItem('veriyo_ref', refParam);

    const activeRef = refParam || localStorage.getItem('veriyo_ref');
    if (!activeRef) return;

    // An anonymous per-browser id — not a true device fingerprint, just
    // enough to stop repeat page loads from the same visitor inflating
    // Total Clicks (the RPC upserts on this instead of inserting fresh).
    let visitorId = localStorage.getItem('veriyo_visitor_id');
    if (!visitorId) {
        visitorId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : (Date.now() + '-' + Math.random().toString(16).slice(2));
        localStorage.setItem('veriyo_visitor_id', visitorId);
    }

    _sbRef.rpc('record_partner_visit', {
        p_partner_code: activeRef,
        p_fingerprint: visitorId
    });
})();
