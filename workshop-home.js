/**
 * Veriyo | Workshop Owner Dashboard (workshop-home.html)
 * Looks up the workshop belonging to whoever is currently signed in,
 * and displays it the same way the public profile page does.
 */

const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
const _supabaseHome = supabase.createClient(supabaseUrl, supabaseKey);

const PRICE_LABELS = {
    price_oil_change: 'Oil Change',
    price_minor_service: 'Minor Service',
    price_major_service: 'Major Service',
    price_alignment: 'Wheel Alignment',
    price_brake_pads: 'Brake Pads',
    price_diagnostic: 'Diagnostic',
};

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _supabaseHome.auth.getSession();

    if (!session) {
        document.getElementById('profileLoading').style.display = 'none';
        sessionStorage.setItem('veriyo_chat_redirect', 'workshop-home.html');
        document.getElementById('profileSignInRequired').style.display = 'block';
        return;
    }

    const { data, error } = await _supabaseHome
        .from('Workshopprofiles')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1);

    document.getElementById('profileLoading').style.display = 'none';

    if (error) {
        document.getElementById('profileError').style.display = 'block';
        return;
    }

    if (!data || data.length === 0) {
        document.getElementById('profileNoListingYet').style.display = 'block';
        return;
    }

    const workshop = data[0];

    const { data: submissions } = await _supabaseHome
        .from('Submissions')
        .select('*')
        .eq('status', 'Approved')
        .ilike('workshop_name', workshop.workshop_name);

    renderProfile(workshop, submissions || []);

    // Pricing accordion toggle
    const accordionToggle = document.getElementById('pricingAccordionToggle');
    const accordionBody = document.getElementById('profilePricing');
    if (accordionToggle && accordionBody) {
        accordionToggle.addEventListener('click', function () {
            const isOpen = accordionToggle.getAttribute('aria-expanded') === 'true';
            accordionToggle.setAttribute('aria-expanded', String(!isOpen));
            accordionBody.hidden = isOpen;
        });
    }
});

function renderProfile(w, submissions) {
    document.title = `${w.workshop_name || 'My Workshop'} — Veriyo`;

    document.getElementById('profileName').textContent = w.workshop_name || 'Unnamed Workshop';
    document.getElementById('profileLocation').textContent =
        [w.suburb, w.city, w.province].filter(Boolean).join(', ');
    document.getElementById('profileHours').textContent = w.operating_hours || 'Not specified';
    document.getElementById('profileYears').textContent =
        w.years_operation ? `${w.years_operation} years` : 'Not specified';
    document.getElementById('profileSpec').textContent = w.specialisation || 'General repairs';

    const rmiEl = document.getElementById('profileRmi');
    rmiEl.textContent = w.rmi_registered === 'Yes' ? 'RMI Registered' : 'Not RMI Registered';
    rmiEl.className = `badge ${w.rmi_registered === 'Yes' ? 'badge-success' : 'badge-neutral'}`;

    const quoteEl = document.getElementById('profileQuote');
    quoteEl.textContent = w.written_quote === 'Yes' ? 'Provides Written Quotes' : 'No Written Quotes';
    quoteEl.className = `badge ${w.written_quote === 'Yes' ? 'badge-success' : 'badge-neutral'}`;

    if (w.photo_url) {
        const photoEl = document.getElementById('profilePhoto');
        photoEl.innerHTML = `<img src="${escapeH(w.photo_url)}" alt="${escapeH(w.workshop_name || 'Workshop')}">`;
    }

    if (w.description) {
        const descEl = document.getElementById('profileDescription');
        descEl.textContent = w.description;
        descEl.style.display = 'block';
    }

    const ratedSubmissions = submissions.filter(s => s.rating && s.rating > 0);
    if (ratedSubmissions.length > 0) {
        const avg = ratedSubmissions.reduce((sum, s) => sum + s.rating, 0) / ratedSubmissions.length;
        document.getElementById('profileRatingValue').textContent =
            `${avg.toFixed(1)} (${ratedSubmissions.length})`;
        document.getElementById('profileRatingBadge').style.display = 'flex';
    }

    // This is the owner's own workshop, so there's no "claim this workshop"
    // banner and no "chat with this workshop" button to show them.
    const claimBanner = document.getElementById('claimBanner');
    if (claimBanner) claimBanner.style.display = 'none';
    const chatBtnWrap = document.querySelector('.chat-workshop-btn-wrap');
    if (chatBtnWrap) chatBtnWrap.style.display = 'none';

    const pricingContainer = document.getElementById('profilePricing');
    const pricingItems = Object.entries(PRICE_LABELS).map(([key, label]) => {
        const val = w[key];
        if (!val || val === 0) return '';
        const formatted = new Intl.NumberFormat('en-ZA', {
            style: 'currency', currency: 'ZAR', minimumFractionDigits: 0
        }).format(val);
        return `
            <div style="border-right:1px solid var(--border-color); padding-right:1rem;">
                <p style="font-size:0.78rem; color:var(--text-secondary); font-weight:600;
                    text-transform:uppercase; letter-spacing:0.5px;">${label}</p>
                <p style="font-size:1.1rem; font-weight:700; color:var(--primary-accent);
                    margin-top:0.25rem;">${formatted}</p>
            </div>`;
    }).filter(Boolean).join('');

    pricingContainer.innerHTML = pricingItems ||
        '<p style="color:var(--text-secondary); font-size:0.9rem;">No pricing listed yet. Add it from List Workshop.</p>';

    const SUBMISSIONS_LIMIT = 6;
    if (submissions.length === 0) {
        document.getElementById('profileNoSubmissions').style.display = 'block';
    } else {
        const seeAllEl = document.getElementById('profileSeeAll');
        if (seeAllEl && submissions.length > SUBMISSIONS_LIMIT) {
            seeAllEl.textContent = `See all (${submissions.length})`;
            seeAllEl.style.display = 'inline';
        }

        document.getElementById('profileSubmissions').innerHTML = submissions.slice(0, SUBMISSIONS_LIMIT).map(row => {
            const cost = new Intl.NumberFormat('en-ZA', {
                style: 'currency', currency: 'ZAR', minimumFractionDigits: 0
            }).format(row.amount_paid || 0);

            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += i <= (row.rating || 0) ? '&#9733;' : '&#9734;';
            }

            return `
                <article class="price-card">
                    <div class="card-header">
                        <div>
                            <h3 class="workshop-title">${escapeH(row.repair_type || 'Repair')}</h3>
                            <span class="suburb-label">${escapeH(row.part_description || '')}</span>
                        </div>
                        <span class="badge badge-success">Approved</span>
                    </div>
                    <div class="car-details">
                        ${escapeH(row.car_make || '')} ${escapeH(row.car_model || '')}
                        ${row.car_year ? '· ' + row.car_year : ''}
                    </div>
                    <div style="display:flex; justify-content:space-between;
                        align-items:center; margin-top:0.5rem;">
                        <div class="price-display">${cost}</div>
                        <div class="rating-stars">${stars}</div>
                    </div>
                    ${row.notes ? `<p class="card-notes">${escapeH(row.notes)}</p>` : ''}
                    <div class="card-date">${row.repair_date || ''}</div>
                </article>`;
        }).join('');
    }

    document.getElementById('profileContent').style.display = 'block';
}

function escapeH(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
