/**
 * Veriyo Repair Status Tracker
 * Allows motorists to track repair progress and workshop managers to update status
 */

// Supabase Configuration — matches the rest of the Veriyo project
const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// DOM Elements
const jobReferenceInput = document.getElementById('jobReference');
const lookupBtn = document.getElementById('lookupBtn');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const stepIndicator = document.getElementById('stepIndicator');
const statusCard = document.getElementById('statusCard');
const currentStatusBadge = document.getElementById('currentStatusBadge');
const statusDetails = document.getElementById('statusDetails');
const notesSection = document.getElementById('notesSection');
const notesContent = document.getElementById('notesContent');
const workshopUpdateSection = document.getElementById('workshopUpdateSection');
const updateForm = document.getElementById('updateForm');
const newStatusSelect = document.getElementById('newStatus');
const newNotesInput = document.getElementById('newNotes');
const updateBtn = document.getElementById('updateBtn');

// Status order for step indicator
const statusOrder = [
    'Received',
    'Diagnosing',
    'Parts Ordered',
    'In Progress',
    'Ready for Collection'
];

// Current repair data
let currentRepair = null;
let currentSession = null;

// A "workshop manager" is a signed-in user (via the same Supabase auth used
// across the rest of Veriyo) who owns the Workshopprofile linked to the repair
// currently being viewed.
function isWorkshopManager() {
    if (!currentSession || !currentRepair) return false;
    const workshop = currentRepair.Workshopprofiles;
    return !!(workshop && workshop.user_id && workshop.user_id === currentSession.user.id);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    currentSession = session;

    // Check URL params for direct lookup
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    if (refParam) {
        jobReferenceInput.value = refParam;
        lookupRepair();
    }
});

// Lookup button handler
lookupBtn.addEventListener('click', lookupRepair);

// Enter key handler
jobReferenceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        lookupRepair();
    }
});

async function lookupRepair() {
    const reference = jobReferenceInput.value.trim();

    if (!reference) {
        showError('Invalid Reference', 'Please enter a job reference code.');
        return;
    }

    // Extract ID from reference (format: VER-12345 or just 12345)
    let repairId = reference;
    if (reference.toUpperCase().startsWith('VER-')) {
        repairId = reference.substring(4);
    }

    // Show loading
    showLoading();

    try {
        const { data, error } = await supabase
            .from('repair_status')
            .select(`
                id,
                workshop_id,
                motorist_session_id,
                car_make,
                car_model,
                repair_type,
                status,
                notes,
                updated_at,
                created_at,
                "Workshopprofiles" (workshop_name, suburb, city, user_id)
            `)
            .eq('id', parseInt(repairId))
            .single();

        if (error || !data) {
            showError('Not Found', 'We couldn\'t find a repair with that reference code. Please check and try again.');
            return;
        }

        currentRepair = data;
        displayRepair(data);

    } catch (err) {
        console.error('Lookup error:', err);
        showError('Error', 'Something went wrong. Please try again.');
    }
}

function displayRepair(repair) {
    // Hide loading/error, show results
    loadingSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    // Update step indicator
    updateStepIndicator(repair.status);

    // Update status badge
    currentStatusBadge.textContent = repair.status;

    // Populate details
    const workshop = repair.Workshopprofiles;
    const workshopName = workshop?.workshop_name || 'Unknown Workshop';
    const workshopArea = workshop?.suburb || workshop?.city || 'Unknown area';

    statusDetails.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Reference</span>
            <span class="detail-value">VER-${repair.id}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Vehicle</span>
            <span class="detail-value">${escapeHtml(repair.car_make || '')} ${escapeHtml(repair.car_model || '')}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Repair Type</span>
            <span class="detail-value">${escapeHtml(repair.repair_type)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Workshop</span>
            <span class="detail-value">${escapeHtml(workshopName)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Location</span>
            <span class="detail-value">${escapeHtml(workshopArea)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Last Updated</span>
            <span class="detail-value">${formatDate(repair.updated_at)}</span>
        </div>
    `;

    // Update notes
    notesContent.textContent = repair.notes || 'No notes yet.';

    // Set current status in dropdown for workshop managers
    if (isWorkshopManager()) {
        newStatusSelect.value = repair.status;
        newNotesInput.value = '';
        workshopUpdateSection.classList.remove('hidden');
    }
}

function updateStepIndicator(currentStatus) {
    const steps = stepIndicator.querySelectorAll('.step');
    const currentIndex = statusOrder.indexOf(currentStatus);

    steps.forEach((step, index) => {
        step.classList.remove('completed', 'active');

        if (index < currentIndex) {
            step.classList.add('completed');
        } else if (index === currentIndex) {
            step.classList.add('active');
        }
    });
}

// Update form handler for workshop managers
updateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentRepair) return;

    const newStatus = newStatusSelect.value;
    const newNotes = newNotesInput.value.trim();

    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    try {
        // Prepare update object
        const updateData = {
            status: newStatus
        };

        // Append new notes to existing notes
        if (newNotes) {
            const timestamp = new Date().toLocaleString('en-ZA', {
                timeZone: 'Africa/Johannesburg'
            });
            updateData.notes = currentRepair.notes
                ? `${currentRepair.notes}\n\n[${timestamp}] ${newNotes}`
                : `[${timestamp}] ${newNotes}`;
        }

        const { error } = await supabase
            .from('repair_status')
            .update(updateData)
            .eq('id', currentRepair.id);

        if (error) {
            throw error;
        }

        // Refresh display
        currentRepair.status = newStatus;
        if (updateData.notes) {
            currentRepair.notes = updateData.notes;
        }

        displayRepair(currentRepair);

        // Clear notes input
        newNotesInput.value = '';

    } catch (err) {
        console.error('Update error:', err);
        alert('Failed to update status. Please try again.');
    } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Status';
    }
});

function showLoading() {
    loadingSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}

function showError(title, message) {
    loadingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.remove('hidden');
    errorTitle.textContent = title;
    errorMessage.textContent = message;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Johannesburg'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
