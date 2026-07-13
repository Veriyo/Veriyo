/**
 * Veriyo | Workshop Profile Page
 * Fetches a single workshop by ID and displays its details
 * plus all approved motorist submissions mentioning it.
 */

const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
const _supabaseProfile = supabase.createClient(supabaseUrl, supabaseKey);

const PRICE_LABELS = {
    price_oil_change: 'Oil Change',
    price_minor_service: 'Minor Service',
    price_major_service: 'Major Service',
    price_alignment: 'Wheel Alignment',
    price_brake_pads: 'Brake Pads',
    price_diagnostic: 'Diagnostic',
};

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const workshopId = params.get('id');

    if (!workshopId) {
        showError();
        return;
    }

    // Fetch workshop record
    const { data: workshop, error: wError } = await _supabaseProfile
        .from('Workshopprofiles')
        .select('*')
        .eq('id', workshopId)
        .single();

    if (wError || !workshop) {
        showError();
        return;
    }

    // Fetch approved submissions mentioning this workshop by name
    const { data: submissions } = await _supabaseProfile
        .from('Submissions')
        .select('*')
        .eq('status', 'Approved')
        .ilike('workshop_name', workshop.workshop_name);

    renderProfile(workshop, submissions || []);

    // Chat button visibility/handler.
    // Spec 8.14: unclaimed listings (no owner yet) never have Chat available.
    // New rule: a workshop account viewing a workshop profile never sees Chat —
    // workshop-to-workshop chat is not a supported conversation type (also
    // matches the DB's own chats_thread_type_check constraint).
    const chatBtn = document.getElementById('chatWorkshopBtn');
    if (chatBtn) {
        if (!workshop.user_id) {
            // Unclaimed listing — no real owner behind it yet.
            chatBtn.style.display = 'none';
        } else {
            const { data: { session } } = await _supabaseProfile.auth.getSession();
            let viewerIsWorkshop = false;
            if (session) {
                const { data: viewerProfile } = await _supabaseProfile
                    .from('account_profiles')
                    .select('account_type')
                    .eq('user_id', session.user.id)
                    .single();
                viewerIsWorkshop = !!(viewerProfile && viewerProfile.account_type === 'workshop');
            }

            if (viewerIsWorkshop) {
                chatBtn.style.display = 'none';
            } else if (workshopId) {
                chatBtn.addEventListener('click', async function () {
                    if (session) {
                        window.location.href = 'chat.html?workshop_id=' + encodeURIComponent(workshopId);
                    } else {
                        window.location.href = 'auth.html?return=' + encodeURIComponent('chat.html?workshop_id=' + workshopId);
                    }
                });
            }
        }
    }

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
    document.title = `${w.workshop_name} — Veriyo`;

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

    // Photo: falls back to the tools icon placeholder already in the markup
    // until a photo_url column exists on Workshopprofiles.
    if (w.photo_url) {
        const photoEl = document.getElementById('profilePhoto');
        photoEl.innerHTML = `<img src="${escapeP(w.photo_url)}" alt="${escapeP(w.workshop_name || 'Workshop')}">`;
    }

    // Optional description/tagline, only shown if the workshop has one set.
    if (w.description) {
        const descEl = document.getElementById('profileDescription');
        descEl.textContent = w.description;
        descEl.style.display = 'block';
    }

    // Star rating badge, averaged from this workshop's approved submissions.
    const ratedSubmissions = submissions.filter(s => s.rating && s.rating > 0);
    if (ratedSubmissions.length > 0) {
        const avg = ratedSubmissions.reduce((sum, s) => sum + s.rating, 0) / ratedSubmissions.length;
        document.getElementById('profileRatingValue').textContent =
            `${avg.toFixed(1)} (${ratedSubmissions.length})`;
        document.getElementById('profileRatingBadge').style.display = 'flex';
    }

    // Show claim banner for unowned workshops (imported by Veriyo, not yet claimed)
    if (!w.user_id && w.status === 'Approved') {
        document.getElementById('claimBanner').style.display = 'block';
        const claimBtn = document.getElementById('claimWorkshopBtn');
        if (claimBtn) {
            claimBtn.href = 'claim-workshop.html?id=' + encodeURIComponent(w.id);
        }
    }

    // Render indicative pricing
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
        '<p style="color:var(--text-secondary); font-size:0.9rem;">No pricing listed.</p>';

// Render submissions (capped to 6 cards, with a "See all" link for the rest)
    const SUBMISSIONS_LIMIT = 6;
    if (submissions.length === 0) {
        document.getElementById('profileNoSubmissions').style.display = 'block';
    } else {
        const seeAllEl = document.getElementById('profileSeeAll');
        if (submissions.length > SUBMISSIONS_LIMIT) {
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
                            <h3 class="workshop-title">${escapeP(row.repair_type || 'Repair')}</h3>
                            <span class="suburb-label">${escapeP(row.part_description || '')}</span>
                        </div>
                        <span class="badge badge-success">Approved</span>
                    </div>
                    <div class="car-details">
                        ${escapeP(row.car_make || '')} ${escapeP(row.car_model || '')}
                        ${row.car_year ? '· ' + row.car_year : ''}
                    </div>
                    <div style="display:flex; justify-content:space-between;
                        align-items:center; margin-top:0.5rem;">
                        <div class="price-display">${cost}</div>
                        <div class="rating-stars">${stars}</div>
                    </div>
                    ${row.notes ? `<p class="card-notes">${escapeP(row.notes)}</p>` : ''}
                    <div class="card-date">${row.repair_date || ''}</div>
                </article>`;
        }).join('');
    }

    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileContent').style.display = 'block';
}

function showError() {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileError').style.display = 'block';
}

function escapeP(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
