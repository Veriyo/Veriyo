/**
 * Veriyo | Referral visit 
 * Records a visit against a partner when someone arrives via their
 * referral link, so Total Clicks on the Partner Portal reflects reality.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _sbRef = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

 // Same localStorage key/format forms.js and list-workshop.js already
    // read from, for crediting a report/signup after the fact — that
    // attribution window still needs the value remembered.
    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (!refParam) return; // no ?ref= on THIS load — not a click, don't count one
    localStorage.setItem('veriyo_ref', refParam);

    // An anonymous per-browser id — not a true device fingerprint, just
    // attached to the click record for future reference.
    let visitorId = localStorage.getItem('veriyo_visitor_id');
    if (!visitorId) {
        visitorId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : (Date.now() + '-' + Math.random().toString(16).slice(2));
        localStorage.setItem('veriyo_visitor_id', visitorId);
    }

    _sbRef.rpc('record_partner_visit', {
        p_partner_code: refParam,
        p_fingerprint: visitorId
    });
