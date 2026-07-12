/**
 * Veriyo | Account-type guard
 *
 * Spec 8.5: a motorist account can't reach workshop-only pages, and a
 * workshop account can't reach motorist-only pages. This file enforces
 * that for whichever page includes it.
 *
 * USAGE (on any page that should be restricted to one account type):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script>window.VERIYO_REQUIRED_TYPE = 'motorist';</script>  <!-- or 'workshop' -->
 *   <script src="auth-guard.js"></script>
 *
 * Pages with no VERIYO_REQUIRED_TYPE set are left untouched by this file
 * (e.g. welcome.html, auth.html, and any page open to both account types).
 *
 * Signed-out visitors are NOT redirected by this guard — each page already
 * has its own "please sign in" prompt for anonymous users. This guard only
 * acts when someone IS signed in but signed in as the wrong type.
 *
 * NOTE: wired into workshop-home.html as of this pass (see BUILD_LOG.md).
 * Still queued for motorist-home.html, my-listing.html, list-workshop.html,
 * report.html, claim-workshop.html — each gets it as it's reached in its
 * own batch, per BUILD_LOG.md.
 */
(function () {
    const REQUIRED_TYPE = window.VERIYO_REQUIRED_TYPE;
    if (!REQUIRED_TYPE) return;

    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseGuard = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    (async function enforce() {
        const { data: { session } } = await _supabaseGuard.auth.getSession();
        if (!session) return; // anonymous visitor — not this guard's job

        const { data: profile, error } = await _supabaseGuard
            .from('account_profiles')
            .select('account_type')
            .eq('user_id', session.user.id)
            .single();

        // Fail open: if the profile lookup fails (network hiccup, etc.) do not
        // lock a legitimate user out of a page they may be entitled to see.
        if (error || !profile) return;

        if (profile.account_type !== REQUIRED_TYPE) {
            window.location.href = profile.account_type === 'workshop' ? 'workshop-home.html' : 'motorist-home.html';
        }
    })();
})();
