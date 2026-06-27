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

    // Render submissions
    if (submissions.length === 0) {
        document.getElementById('profileNoSubmissions').style.display = 'block';
    } else {
        document.getElementById('profileSubmissions').innerHTML = submissions.map(row => {
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
