/**
 * Veriyo | Referral visit - fixed
 */
(function () {
  try {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    if (!window.supabase) return;
    const _sbRef = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (!refParam) return;
    localStorage.setItem('veriyo_ref', refParam);

    let visitorId = localStorage.getItem('veriyo_visitor_id');
    if (!visitorId) {
      visitorId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem('veriyo_visitor_id', visitorId);
    }

    _sbRef.rpc('record_partner_visit', {
      p_partner_code: refParam,
      p_fingerprint: visitorId
    }).then(({ error }) => {
      if (error) console.error('record_partner_visit failed', error);
    });
  } catch (e) {
    console.error('referral.js error', e);
  }
})();
