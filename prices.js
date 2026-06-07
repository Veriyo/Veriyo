/**
 * Veriyo | Built for South African drivers
 * Price Transparency Verification Engine & Live Queries
 */

// Production Mock Dataset Infrastructure
const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc'
const _supabasePrices = supabase.createClient(supabaseUrl, supabaseKey)
let liveDataset = [];;

document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('pricesContainer')) {
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
                workshopName: row.workshop_name || '',
                suburb: row.suburb || '',
                city: row.city || '',
                carMake: row.car_brand || 'Unknown',
                carModel: row.car_model || 'Unknown',
                year: row.car_year || new Date().getFullYear(),
                repairType: row.repair_type || 'Other',
                partDescription: row.part_description || '',
                amountQuoted: row.amount_quoted || 0,
                amountPaid: row.amount_paid || 0,
                priceChanged: row.price_changed || '',
                pricingExplained: row.pricing_explained || '',
                newProblems: row.new_problems || 'No',
                rating: row.rating || 3,
                notes: row.notes || '',
                status: row.status || 'Approved',
                timestamp: row.repair_date || null
            }));

            // Merge live Supabase records with hardcoded array — hardcoded stays intact
            // Supabase is the only data source
liveDataset = normalizedLive;;

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

   const filterMinPrice = document.getElementById('filterMinPrice');
    const filterMaxPrice = document.getElementById('filterMaxPrice');
    const executionTriggers = [filterSuburb, filterMake, filterRepair, filterRating, sortByInput, filterMinPrice, filterMaxPrice];
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
    const queryMin = parseFloat(document.getElementById('filterMinPrice').value) || 0;
    const queryMax = parseFloat(document.getElementById('filterMaxPrice').value) || Infinity;
const repairAverages = {};
    liveDataset.filter(i => i.status === 'Approved').forEach(i => {
        if (!repairAverages[i.repairType]) repairAverages[i.repairType] = { total: 0, count: 0 };
        repairAverages[i.repairType].total += i.amountPaid;
        repairAverages[i.repairType].count += 1;
    });

    let analyticalOutput = liveDataset.filter(item => {
       if (item.status !== "Approved") return false;

   if (querySuburb && !(item.suburb || '').toLowerCase().includes(querySuburb)) return false;
if (queryMake !== "All" && item.carMake !== queryMake) return false;
if (queryRepair !== "All" && item.repairType !== queryRepair) return false;  
if (item.amountPaid < queryMin || item.amountPaid > queryMax) return false;
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
        const quoteDeltaMarkup = parseQuoteDifferenceBadge(entry.priceChanged);
        const cascadingDefectsMarkup = entry.newProblems === "Yes" 
            ? `<span class="badge badge-danger">New Problems Appeared</span>` 
            : `<span class="badge badge-neutral">No Post-Repair Issues</span>`;

        // Render graphical star configurations safely
        let starsElement = "";
        for (let idx = 1; idx <= 5; idx++) {
            starsElement += idx <= entry.rating ? "&#9733;" : "&#9734;";
        }

        // Extrapolates standard ISO dates to clean localized views
       const calculatedDateStr = entry.timestamp ? convertToMonthYearFormat(entry.timestamp) : 'Date not provided';

        return `
            <article class="price-card">
                <div class="card-header">
                    <div>
                        <h3 class="workshop-title">${escapeHTML(entry.workshopName)}</h3>
                        <span class="suburb-label">${escapeHTML(entry.suburb)}, ${escapeHTML(entry.city)}</span>
                    </div>
                    <span class="badge badge-success">${entry.status}</span>
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
                    ${quoteDeltaMarkup}
                    ${cascadingDefectsMarkup}
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
            </article>
        `;
    }).join('');
}

/**
 * Contextual Badge styling assignments
 */
function parseQuoteDifferenceBadge(statusValue) {
    if (statusValue.includes("higher")) {
        return `<span class="badge badge-danger">Price Changed (Higher)</span>`;
    } else if (statusValue.includes("lower")) {
        return `<span class="badge badge-success">Price Changed (Lower)</span>`;
    } else if (statusValue.includes("matched")) {
        return `<span class="badge badge-success">Matched Quote Exactly</span>`;
    } else {
        return `<span class="badge badge-neutral">No Upfront Quote Given</span>`;
    }
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
