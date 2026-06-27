// Initialize Supabase client
// Credentials should be available via window.__SUPABASE_CONFIG__ or config.js
const SUPABASE_URL = window.__SUPABASE_CONFIG__?.url || window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.__SUPABASE_CONFIG__?.anonKey || window.SUPABASE_ANON_KEY || '';

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// DOM Elements
const helpForm = document.getElementById('helpForm');
const repairTypeSelect = document.getElementById('repairType');
const problemDescription = document.getElementById('problemDescription');
const suburbInput = document.getElementById('suburb');
const resultsSection = document.getElementById('resultsSection');
const resultsHeader = document.getElementById('resultsHeader');
const resultsContainer = document.getElementById('resultsContainer');

// Handle form submission
helpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const repairType = repairTypeSelect.value;
    const suburb = suburbInput.value.trim();
    const description = problemDescription.value.trim();

    if (!repairType || !suburb) {
        showError('Please select a repair type and enter your suburb.');
        return;
    }

    // Show loading state
    showLoading();

    try {
        await searchWorkshops(repairType, suburb);
    } catch (error) {
        console.error('Error searching workshops:', error);
        showError('Unable to search for workshops. Please try again.');
    }
});

async function searchWorkshops(repairType, suburb) {
    if (!supabase) {
        // Fallback: check if Supabase isn't initialized
        showNoResults(suburb, repairType);
        return;
    }

    // Normalize suburb for search (case-insensitive)
    const suburbLower = suburb.toLowerCase();
    const suburbCapitalized = suburb.charAt(0).toUpperCase() + suburb.slice(1).toLowerCase();

    // Query workshops matching location and specialisation
    // Check both suburb and city for matches
    const { data: workshops, error } = await supabase
        .from('Workshopprofiles')
        .select('id, workshop_name, suburb, city, province, specialisation, contact_number, operating_hours')
        .or(`suburb.ilike.%${suburbLower}%,suburb.ilike.%${suburbCapitalized}%,city.ilike.%${suburbLower}%,city.ilike.%${suburbCapitalized}%`)
        .ilike('specialisation', `%${repairType}%')
        .eq('status', 'Approved');

    if (error) {
        console.error('Supabase query error:', error);
        throw error;
    }

    // Also try broader search - any workshop with the specialisation in the same city/province
    let allWorkshops = workshops || [];

    if (allWorkshops.length === 0) {
        // Try matching just by specialisation and general area
        const { data: broaderResults } = await supabase
            .from('Workshopprofiles')
            .select('id, workshop_name, suburb, city, province, specialisation, contact_number, operating_hours')
            .ilike('specialisation', `%${repairType}%`)
            .eq('status', 'Approved')
            .limit(20);

        if (broaderResults && broaderResults.length > 0) {
            allWorkshops = broaderResults;
        }
    }

    displayResults(allWorkshops, suburb, repairType);
}

function displayResults(workshops, suburb, repairType) {
    resultsSection.classList.remove('hidden');
    resultsContainer.innerHTML = '';

    if (!workshops || workshops.length === 0) {
        showNoResults(suburb, repairType);
        return;
    }

    // Sort by rating (we'll need to fetch ratings separately or use a default)
    // For now, sort by workshop name as placeholder
    const sortedWorkshops = workshops.sort((a, b) => {
        // Priority to exact suburb match, then city match
        const aSuburbMatch = a.suburb?.toLowerCase().includes(suburb.toLowerCase()) ? 0 : 1;
        const bSuburbMatch = b.suburb?.toLowerCase().includes(suburb.toLowerCase()) ? 0 : 1;
        return aSuburbMatch - bSuburbMatch;
    });

    resultsHeader.textContent = \`Found ${sortedWorkshops.length} workshop${sortedWorkshops.length !== 1 ? 's' : ''} for ${repairType}`;
        )

    sortedWorkshops.forEach(workshop => {
        const card = createWorkshopCard(workshop);
        resultsContainer.appendChild(card);
    });
}

function createWorkshopCard(workshop) {
    const card = document.createElement('div');
    card.className = 'workshop-card';

    const area = workshop.suburb || workshop.city || 'Unknown area';
    const rating = workshop.rating || 'N/A';

    card.innerHTML = `
        <div class="workshop-name">${escapeHtml(workshop.workshop_name)}</div>
        <div class="workshop-details">
            <div class="workshop-detail">
                <span>&#128205;</span>
                <span>${escapeHtml(area)}</span>
            </div>
            ${workshop.specialisation ? `
            <div class="workshop-detail">
                <span>&#128295;</span>
                <span>${escapeHtml(workshop.specialisation)}</span>
            </div>
            ` : ''}
            <div class="workshop-detail">
                <span class="workshop-rating">&#9733; ${rating}</span>
            </div>
        </div>
        <a href="chat.html?workshop_id=${workshop.id}" class="btn-chat">Chat</a>
    `;

    return card;
}

function showLoading() {
    resultsSection.classList.remove('hidden');
    resultsHeader.textContent = 'Searching for workshops...';
    resultsContainer.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Finding workshops near you...</p>
        </div>
    `;
}

function showNoResults(suburb, repairType) {
    resultsSection.classList.remove('hidden');
    resultsHeader.textContent = 'No workshops found';
    resultsContainer.innerHTML = `
        <div class="no-results">
            <h3>No workshops found</h3>
            <p>We couldn't find any workshops in <strong>${escapeHtml(suburb)}</strong> specializing in <strong>${escapeHtml(repairType)}</strong>.</p>
            <p>Try expanding your search to a nearby area, or select a different repair type.</p>
        </div>
    `;
}

function showError(message) {
    resultsSection.classList.remove('hidden');
    resultsHeader.textContent = 'Error';
    resultsContainer.innerHTML = `
        <div class="no-results">
            <h3>Something went wrong</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}