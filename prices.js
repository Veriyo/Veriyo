/**
 * Veriyo | Built for South African drivers
 * Price Transparency Verification Engine & Live Queries
 */

// Production Mock Dataset Infrastructure
const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc'
const _supabasePrices = supabase.createClient(supabaseUrl, supabaseKey)
let liveDataset = [];

let isMotoristViewer = false;
let myWorkshopId = null;
document.addEventListener('DOMContentLoaded', async () => {
if (document.getElementById('pricesContainer')) {
        const { data: { session: pricesSession } } = await _supabasePrices.auth.getSession();
        if (pricesSession) {
            const { data: viewerProfile } = await _supabasePrices
                .from('account_profiles')
                .select('account_type')
                .eq('user_id', pricesSession.user.id)
                .single();
            isMotoristViewer = !!(viewerProfile && viewerProfile.account_type === 'motorist');

            // Needed to gate the "Respond to this report" button — only the
            // workshop a report is actually about should ever see it, and
            // motorists must never see it at all.
            if (!isMotoristViewer) {
                const { data: myWorkshopRows } = await _supabasePrices
                    .from('Workshopprofiles')
                    .select('id')
                    .eq('user_id', pricesSession.user.id)
                    .limit(1);
                myWorkshopId = (myWorkshopRows && myWorkshopRows.length > 0) ? myWorkshopRows[0].id : null;
            }
        }

        initPriceListingFilters();
        // Fetch live verified records from Supabase and merge with hardcoded set
        const { data, error } = await _supabasePrices
            .from('Submissions')
            .select('*')
            .eq('status', 'Approved');

        if (!error && data && data.length > 0) {
            // Normalize Supabase snake_case fields to match hardcoded array format
const normalizedLive = data.map(row => ({
                id: row.id,
                status: 'Approved',
                workshopId: row.workshop_id || null,
                carMake: row.car_make || '',
                carModel: row.car_model || '',
                year: row.car_year || '',
                repairType: row.repair_type || '',
                partDescription: row.part_description || '',
                amountPaid: parseFloat(row.amount_paid) || 0,
                workshopName: row.workshop_name || '',
                suburb: row.suburb || '',
                city: row.city || '',
                province: row.province || '',
                rating: parseInt(row.rating) || 0,
                feltOvercharged: row.felt_overcharged ?? null,
                feltOverchargedReason: row.felt_overcharged_reason || '',
                staffTreatment: row.staff_treatment || null,
                staffTreatmentReason: row.staff_treatment_reason || '',
notes: row.notes || '',
                timestamp: row.repair_date || '',
                workshopResponse: null,
                recentlyActive: row.updated_at
                    ? (new Date() - new Date(row.updated_at)) < 7 * 24 * 60 * 60 * 1000
                    : false
            }));

            liveDataset = normalizedLive;

            // Attach any existing workshop response for each report
            const submissionIds = normalizedLive.map(r => r.id);
            if (submissionIds.length > 0) {
                const { data: responseRows } = await _supabasePrices
                    .from('report_responses')
                    .select('submission_id, response_text')
                    .in('submission_id', submissionIds);
                const responseBySubmission = {};
                (responseRows || []).forEach(r => { responseBySubmission[r.submission_id] = r.response_text; });
                liveDataset = liveDataset.map(r => ({ ...r, workshopResponse: responseBySubmission[r.id] || null }));
            }

            // Re-render with the combined dataset now available
            processingPipeAndRender();
            
            const suburbList = document.getElementById('suburbSuggestions');
            if (suburbList) {
                const uniqueSuburbs = [...new Set(normalizedLive.map(r => r.suburb).filter(Boolean))].sort();
                uniqueSuburbs.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    suburbList.appendChild(opt);
                });
            }

            // Deep link from a workshop notification: jump straight to
            // responding to the specific report that was flagged
            const reportParam = new URLSearchParams(window.location.search).get('report');
            if (reportParam && myWorkshopId) {
                const targetId = parseInt(reportParam, 10);
                const targetEntry = liveDataset.find(e => e.id === targetId);
                if (targetEntry && targetEntry.workshopId === myWorkshopId) {
                    openRespondModal(targetId);
                }
            }
        } else {
            // Fallback rendering phase if live download encounters no records
            processingPipeAndRender();
        }
    }
});
/**
 * Initializes listeners for standard input manipulation components
 */
function initPriceListingFilters() {
    const filterSuburb = document.getElementById('filterSuburb');
    const filterMake = document.getElementById('filterMake');
    const filterRepair = document.getElementById('filterRepair');
    const filterRating = document.getElementById('filterRating');
    const sortByInput = document.getElementById('sortBy');

  const executionTriggers = [filterSuburb, filterMake, filterRepair, filterRating, sortByInput];
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filterGridPanel = document.getElementById('filterGridPanel');
    if (filterToggleBtn && filterGridPanel) {
        filterToggleBtn.addEventListener('click', () => {
            filterGridPanel.classList.toggle('filter-open');
            filterToggleBtn.textContent = filterGridPanel.classList.contains('filter-open') ? '▲ Filter & Sort' : '▼ Filter & Sort';
        });
    }
    executionTriggers.forEach(element => {
        if (element) {
            element.addEventListener('input', processingPipeAndRender);
            element.addEventListener('change', processingPipeAndRender);
        }
    });

// Saved workshops toggle button — injected above the prices container
    const pricesContainer = document.getElementById('pricesContainer');
    if (pricesContainer) {
        const savedToggleBtn = document.createElement('button');
        savedToggleBtn.id = 'savedToggleBtn';
        savedToggleBtn.className = 'btn btn-secondary';
        savedToggleBtn.style.cssText = 'margin-bottom:1rem; font-size:0.85rem; padding:0.5rem 1.2rem;';
        savedToggleBtn.textContent = '🔖 Show Saved Workshops';
        savedToggleBtn.addEventListener('click', () => {
            const isShowingSaved = savedToggleBtn.dataset.active === 'true';
            savedToggleBtn.dataset.active = isShowingSaved ? 'false' : 'true';
            savedToggleBtn.textContent = isShowingSaved ? '🔖 Show Saved Workshops' : '✕ Show All Workshops';
            processingPipeAndRender();
        });
        pricesContainer.parentElement.insertBefore(savedToggleBtn, pricesContainer);
    }

    // Execute absolute initial display draw
    processingPipeAndRender();
}

/**
 * Coordinates calculation routines and renders cards array configuration
 */
function processingPipeAndRender() {
    const container = document.getElementById('pricesContainer');
    if (!container) return;

    // Direct Extraction values
    const querySuburb = document.getElementById('filterSuburb').value.trim().toLowerCase();
    const queryMake = document.getElementById('filterMake').value;
    const queryRepair = document.getElementById('filterRepair').value;
    const queryRating = document.getElementById('filterRating').value;
  const sortingToken = document.getElementById('sortBy').value;
   
const repairAverages = {};
    liveDataset.filter(i => i.status === 'Approved').forEach(i => {
        if (!repairAverages[i.repairType]) repairAverages[i.repairType] = { total: 0, count: 0 };
        repairAverages[i.repairType].total += i.amountPaid;
        repairAverages[i.repairType].count += 1;
    });

const savedToggleBtn = document.getElementById('savedToggleBtn');
    const showingSavedOnly = savedToggleBtn?.dataset.active === 'true';
    const savedIds = JSON.parse(localStorage.getItem('veriyo_saved_workshops') || '[]');

    let analyticalOutput = liveDataset.filter(item => {
       if (item.status !== "Approved") return false;
       if (showingSavedOnly && !savedIds.includes(item.id)) return false;

   if (querySuburb && !(item.suburb || '').toLowerCase().includes(querySuburb)) return false;
if (queryMake !== "All" && item.carMake !== queryMake) return false;
if (queryRepair !== "All" && item.repairType !== queryRepair) return false;  

        if (queryRating !== "All") {
                   const floorLimit = parseInt(queryRating, 10);
            if (item.rating < floorLimit) return false;
        }

        return true;
    });

    // Multi-criteria sorting matrices
    analyticalOutput.sort((alpha, beta) => {
        switch (sortingToken) {
            case "highestAmount":
                return beta.amountPaid - alpha.amountPaid;
            case "lowestAmount":
                return alpha.amountPaid - beta.amountPaid;
            case "lowestRated":
                return alpha.rating - beta.rating;
            case "mostRecent":
            default:
                return new Date(beta.timestamp) - new Date(alpha.timestamp);
        }
    });

    // Render operations execution
    if (analyticalOutput.length === 0) {
container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.2rem; color: var(--text-primary);">No verified repairs found for this filter combination.</p>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">This area might not have submissions yet — you could be the first.</p>
                <a href="report.html" class="btn btn-primary" style="display:inline-block; margin-top:1.5rem;">Report What You Paid</a>
            </div>`;
        return;
    }

    container.innerHTML = analyticalOutput.map(entry => {
        // String converters for South African Currency Formatting standards
        const formattedCost = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(entry.amountPaid);
        
        // Evaluates internal flags to draw respective markup badges
const pricingFairnessMarkup = entry.feltOvercharged === true
            ? `<span class="badge badge-danger">Driver felt overcharged</span>`
            : entry.feltOvercharged === false
            ? `<span class="badge badge-success">Driver felt fairly priced</span>`
            : '';

        const staffMarkup = entry.staffTreatment === 'helpful'
            ? `<span class="badge badge-success">Staff were helpful</span>`
            : entry.staffTreatment === 'unhelpful'
            ? `<span class="badge badge-danger">Staff were unhelpful</span>`
            : '';
        // Render graphical star configurations safely
        let starsElement = "";
        for (let idx = 1; idx <= 5; idx++) {
            starsElement += idx <= entry.rating ? "&#9733;" : "&#9734;";
        }

        // Extrapolates standard ISO dates to clean localized views
       const calculatedDateStr = entry.timestamp ? convertToMonthYearFormat(entry.timestamp) : 'Date not provided';
const savedWorkshops = JSON.parse(localStorage.getItem('veriyo_saved_workshops') || '[]');
        const isSaved = savedWorkshops.includes(entry.id);

        return `
            <article class="price-card">
                <div class="card-header">
                    <div>
                        <h3 class="workshop-title">${entry.recentlyActive ? '<span style="color:var(--success-color); font-size:0.7rem; margin-right:0.4rem;">●</span>' : ''}${escapeHTML(entry.workshopName)}</h3>
                        <span class="suburb-label">${entry.suburb ? escapeHTML(entry.suburb) + ', ' : ''}${escapeHTML(entry.city)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <button onclick="toggleSavedWorkshop(${entry.id})" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:${isSaved ? 'var(--primary-accent)' : 'var(--text-secondary)'};" title="${isSaved ? 'Remove from saved' : 'Save this workshop'}">
                            ${isSaved ? '🔖' : '🔖'}
                        </button>
                        <span class="badge badge-success">${entry.status}</span>
                    </div>
                </div>

                
                <div>
                  ${(entry.carMake === 'Unknown' && (entry.carModel === 'Unknown' || entry.carModel === '')) ? '' : `<div class="car-details"><span style="color: var(--text-secondary); font-weight: 400; font-size: 0.9rem; margin-right: 0.3rem;">Vehicle</span> ${escapeHTML(entry.carMake)} ${escapeHTML(entry.carModel)}</div>`}
                    <div class="repair-type"><span style="color: var(--text-secondary); font-weight: 400; font-size: 0.9rem; margin-right: 0.3rem;">Repair</span> ${escapeHTML(entry.repairType)} — <span style="color: var(--text-secondary); font-size: 0.95rem;">${escapeHTML(entry.partDescription)}</span></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                    <div class="price-display">${formattedCost}</div>
                    <div class="rating-stars" title="Rating: ${entry.rating}/5">${starsElement}</div>
                </div>

<div class="card-meta-row">
                    ${pricingFairnessMarkup}
                    ${staffMarkup}
                </div>
                ${entry.notes ? `<p class="card-notes">${escapeHTML(entry.notes)}</p>` : ''}
                
             ${(() => {
                    const avg = repairAverages[entry.repairType];
                    if (!avg || avg.count < 2) return '';
                    const avgVal = Math.round(avg.total / avg.count);
                    const formatted = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(avgVal);
                    return `<div style="font-size:0.78rem; color:var(--text-secondary); border-top:1px solid var(--border-color); padding-top:0.5rem;">Avg for ${escapeHTML(entry.repairType)}: ${formatted}</div>`;
                })()}

<div class="card-date">Repaired: ${calculatedDateStr}</div>
                ${entry.workshopResponse ? `<div class="card-workshop-response" style="margin-top:0.6rem; padding:0.6rem 0.75rem; background:var(--bg-color); border-left:3px solid var(--primary-accent); border-radius:4px;">
                    <p style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; color:var(--text-secondary); margin-bottom:0.25rem;">Response from the workshop</p>
                    <p style="font-size:0.85rem; color:var(--text-primary); white-space:pre-wrap;">${escapeHTML(entry.workshopResponse)}</p>
                </div>` : ''}
                ${(!isMotoristViewer && myWorkshopId && entry.workshopId && entry.workshopId === myWorkshopId) ? `<button onclick="openRespondModal(${entry.id})"
                    style="background:none; border:none; color:var(--primary-accent);
                    font-size:0.75rem; cursor:pointer; padding:0; margin-top:0.4rem;
                    text-decoration:underline; font-weight:600;">
                    ${entry.workshopResponse ? 'Edit your response' : 'Respond to this report'}
                </button>` : ''}
                ${isMotoristViewer ? '' : `<button onclick="openClaimModal('${escapeHTML(entry.workshopName)}')"
                    style="background:none; border:none; color:var(--text-secondary);
                    font-size:0.75rem; cursor:pointer; padding:0; margin-top:0.25rem;
                    text-decoration:underline;">
                    Is this your workshop? Claim this listing
                </button>`}
            </article>
        `;
    }).join('');

    // Inject claim modal if not already present
    if (!document.getElementById('claimModal')) {
        const modal = document.createElement('div');
        modal.id = 'claimModal';
        modal.style.cssText = `display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7);
            z-index:9999; align-items:center; justify-content:center;`;
        modal.innerHTML = `
            <div style="background:var(--surface-color); border:1px solid var(--border-color);
                border-radius:var(--radius); padding:2rem; max-width:420px; width:90%; position:relative;">
                <button onclick="closeClaimModal()" style="position:absolute; top:1rem; right:1rem;
                    background:none; border:none; color:var(--text-secondary); font-size:1.2rem;
                    cursor:pointer;">✕</button>
                <h3 style="margin-bottom:1rem; font-size:1.1rem;">Claim This Workshop</h3>
                <div class="form-group">
                    <label style="font-size:0.85rem; font-weight:600;">Workshop Name</label>
                    <input id="claimWorkshopName" type="text" class="form-control"
                        style="margin-top:0.4rem;" readonly />
                </div>
                <div class="form-group" style="margin-top:0.75rem;">
                    <label style="font-size:0.85rem; font-weight:600;">Your Email *</label>
                    <input id="claimEmail" type="email" class="form-control"
                        style="margin-top:0.4rem;" placeholder="you@example.com" />
                </div>
                <div class="form-group" style="margin-top:0.75rem;">
                    <label style="font-size:0.85rem; font-weight:600;">Brief Message</label>
                    <textarea id="claimMessage" class="form-control" rows="3"
                        style="margin-top:0.4rem;" maxlength="200"
                        placeholder="e.g. I am the owner and would like to manage this listing."></textarea>
                </div>
                <p id="claimError" style="display:none; color:var(--danger-color);
                    font-size:0.82rem; margin-top:0.5rem;"></p>
                <button onclick="submitClaim()"
                    id="claimSubmitBtn"
                    style="margin-top:1rem; width:100%; background:var(--primary-accent);
                    color:#000; border:none; padding:0.75rem; border-radius:var(--radius);
                    font-weight:700; cursor:pointer;">
                    Submit Claim
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}
// Inject respond-to-report modal if not already present
    if (!document.getElementById('respondModal')) {
        const modal = document.createElement('div');
        modal.id = 'respondModal';
        modal.style.cssText = `display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7);
            z-index:9999; align-items:center; justify-content:center;`;
        modal.innerHTML = `
            <div style="background:var(--surface-color); border:1px solid var(--border-color);
                border-radius:var(--radius); padding:2rem; max-width:420px; width:90%; position:relative;">
                <button onclick="closeRespondModal()" style="position:absolute; top:1rem; right:1rem;
                    background:none; border:none; color:var(--text-secondary); font-size:1.2rem;
                    cursor:pointer;">✕</button>
                <h3 style="margin-bottom:1rem; font-size:1.1rem;">Respond to This Report</h3>
                <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.75rem;">
                    Share your side of the story. This will be shown publicly under the report.
                </p>
                <div class="form-group">
                    <textarea id="respondText" class="form-control" rows="5" maxlength="800"
                        placeholder="e.g. We reached out to this customer and..."></textarea>
                </div>
                <p id="respondError" style="display:none; color:var(--danger-color);
                    font-size:0.82rem; margin-top:0.5rem;"></p>
                <button onclick="submitReportResponse()"
                    id="respondSubmitBtn"
                    style="margin-top:1rem; width:100%; background:var(--primary-accent);
                    color:#000; border:none; padding:0.75rem; border-radius:var(--radius);
                    font-weight:700; cursor:pointer;">
                    Submit Response
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
function openClaimModal(workshopName) {
    const modal = document.getElementById('claimModal');
    document.getElementById('claimWorkshopName').value = workshopName;
    document.getElementById('claimEmail').value = '';
    document.getElementById('claimMessage').value = '';
    document.getElementById('claimError').style.display = 'none';
    document.getElementById('claimSubmitBtn').textContent = 'Submit Claim';
    document.getElementById('claimSubmitBtn').disabled = false;
    modal.style.display = 'flex';
}

function closeClaimModal() {
    document.getElementById('claimModal').style.display = 'none';
}

async function submitClaim() {
    const name = document.getElementById('claimWorkshopName').value;
    const email = document.getElementById('claimEmail').value.trim();
    const message = document.getElementById('claimMessage').value.trim();
    const errorEl = document.getElementById('claimError');
    const btn = document.getElementById('claimSubmitBtn');

    if (!email) {
        errorEl.textContent = 'Please enter your email address.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const { error } = await _supabasePrices
        .from('workshop_claims')
        .insert([{
            workshop_name: name,
            contact_email: email,
            message: message || null,
            status: 'Pending'
        }]);

    if (error) {
        errorEl.textContent = 'Submission failed. Please try again.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Submit Claim';
    } else {
        btn.textContent = 'Claim Submitted ✓';
        setTimeout(() => closeClaimModal(), 1500);
    }
}

let _respondSubmissionId = null;

function openRespondModal(submissionId) {
    _respondSubmissionId = submissionId;
    const entry = liveDataset.find(e => e.id === submissionId);
    document.getElementById('respondText').value = (entry && entry.workshopResponse) || '';
    document.getElementById('respondError').style.display = 'none';
    document.getElementById('respondSubmitBtn').textContent = 'Submit Response';
    document.getElementById('respondSubmitBtn').disabled = false;
    document.getElementById('respondModal').style.display = 'flex';
}

function closeRespondModal() {
    document.getElementById('respondModal').style.display = 'none';
    _respondSubmissionId = null;
}

async function submitReportResponse() {
    const text = document.getElementById('respondText').value.trim();
    const errorEl = document.getElementById('respondError');
    const btn = document.getElementById('respondSubmitBtn');

    if (!text) {
        errorEl.textContent = 'Please enter a response before submitting.';
        errorEl.style.display = 'block';
        return;
    }
    if (!myWorkshopId || !_respondSubmissionId) {
        errorEl.textContent = 'Unable to submit — please refresh and try again.';
        errorEl.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const { error } = await _supabasePrices
        .from('report_responses')
        .upsert([{
            submission_id: _respondSubmissionId,
            workshop_id: myWorkshopId,
            response_text: text
        }], { onConflict: 'submission_id' });

    if (error) {
        errorEl.textContent = 'Submission failed. Please try again.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Submit Response';
        return;
    }

    const idx = liveDataset.findIndex(e => e.id === _respondSubmissionId);
    if (idx !== -1) liveDataset[idx].workshopResponse = text;

    btn.textContent = 'Response Submitted ✓';
    setTimeout(() => { closeRespondModal(); processingPipeAndRender(); }, 1000);
}
/**
 * Contextual Badge styling assignments
 * Quote difference badges removed — field dropped from submissions.
 * Experience badges are now rendered inline in the card template.
 */
function parseBadgePlaceholder() {
    // Reserved for future badge logic extensions.
    return '';
}

/**
 * Saves or removes a workshop ID from localStorage
 */
function toggleSavedWorkshop(id) {
    let saved = JSON.parse(localStorage.getItem('veriyo_saved_workshops') || '[]');
    if (saved.includes(id)) {
        saved = saved.filter(s => s !== id);
    } else {
        saved.push(id);
    }
    localStorage.setItem('veriyo_saved_workshops', JSON.stringify(saved));
    processingPipeAndRender();
}
/**
 * Conversions function for timestamps
 */
function convertToMonthYearFormat(isoDateString) {
    const targetObj = new Date(isoDateString);
    if (isNaN(targetObj.getTime())) return "Unknown Date";
    const calendarMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${calendarMonths[targetObj.getMonth()]} ${targetObj.getFullYear()}`;
}

/**
 * XSS Deflection Mechanism
 */
function escapeHTML(unsafeString) {
    return unsafeString
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
