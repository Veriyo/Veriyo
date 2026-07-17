/**
 * Veriyo Admin Dashboard
 * Supabase Auth + Submission moderation (approve / reject)
 * Handles both Motorist Reports (Submissions) and Workshop Listings (Workshopprofiles)
 */
const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let pendingMotoristRecords = [];
let pendingWorkshopRecords = [];
let pendingClaimRecords = [];
let pendingQuickClaimRecords = [];
let liveWorkshopRecords = [];
let livePriceRecords = [];
let currentTab = 'motorist';
let currentAdminEmail = null;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    refreshBtn.addEventListener('click', () => loadAllPending());

    document.getElementById('goDashboardBtn').addEventListener('click', async () => {
        showDashboard();
        await loadAllPending();
    });
    document.getElementById('goPartnerBtn').addEventListener('click', showPartnerStub);
    document.getElementById('dashboardBackBtn').addEventListener('click', showRoleChoice);
   const partnerBackBtn = document.getElementById('partnerBackBtn');
if (partnerBackBtn) partnerBackBtn.addEventListener('click', showRoleChoice);

const partnerLogoutBtn = document.getElementById('partnerLogoutBtn');
if (partnerLogoutBtn) partnerLogoutBtn.addEventListener('click', handleLogout);
   

    const notifBell = document.getElementById('notifBell');
    const suggestionsPanel = document.getElementById('suggestionsPanel');
    notifBell.addEventListener('click', async () => {
        const isOpen = suggestionsPanel.style.display !== 'none';
        suggestionsPanel.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) await loadSuggestions();
    });
document.getElementById('suggestionsPanelClose').addEventListener('click', () => {
        suggestionsPanel.style.display = 'none';
    });

document.getElementById('addListingBtn').addEventListener('click', () => {
        document.getElementById('addListingForm').reset();
        document.getElementById('addListingError').style.display = 'none';
        document.getElementById('addListingModal').style.display = 'flex';
    });
    document.getElementById('addListingCancelBtn').addEventListener('click', () => {
        document.getElementById('addListingModal').style.display = 'none';
    });
    document.getElementById('addListingForm').addEventListener('submit', handleAddListing);
// Tab switching
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll('#adminNavMenuDropdown .header-nav-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            document.getElementById('adminNavMenuDropdown').style.display = 'none';
        });
    });
    document.getElementById('adminNavMenuToggle').addEventListener('click', () => {
        const menu = document.getElementById('adminNavMenuDropdown');
        const isOpen = menu.style.display !== 'none';
        menu.style.display = isOpen ? 'none' : 'flex';
        document.getElementById('adminNavMenuToggle').setAttribute('aria-expanded', String(!isOpen));
    });
    document.getElementById('adminAvatarToggle').addEventListener('click', () => {
        const dropdown = document.getElementById('adminAvatarDropdown');
        const isOpen = dropdown.style.display !== 'none';
        dropdown.style.display = isOpen ? 'none' : 'flex';
        document.getElementById('adminAvatarToggle').setAttribute('aria-expanded', String(!isOpen));
    });
    document.getElementById('logoutBtnMobile').addEventListener('click', handleLogout);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-nav-menu-wrap')) document.getElementById('adminNavMenuDropdown').style.display = 'none';
        if (!e.target.closest('.header-avatar-wrap')) document.getElementById('adminAvatarDropdown').style.display = 'none';
    });

    checkSession();
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('admin-tab-btn--active', isActive);
        btn.style.borderBottomColor = isActive ? 'var(--primary-accent)' : 'transparent';
        btn.style.color = isActive ? 'var(--primary-accent)' : 'var(--text-secondary)';
    });

document.querySelectorAll('#adminNavMenuDropdown .header-nav-menu-item').forEach(btn => {
        btn.classList.toggle('header-nav-menu-item--active', btn.dataset.tab === tab);
    });

document.getElementById('motoristPanel').style.display = tab === 'motorist' ? 'block' : 'none';
    document.getElementById('workshopPanel').style.display = tab === 'workshop' ? 'block' : 'none';
document.getElementById('liveWorkshopPanel').style.display = tab === 'live' ? 'block' : 'none';
    document.getElementById('claimsPanel').style.display = tab === 'claims' ? 'block' : 'none';
    document.getElementById('quickClaimsPanel').style.display = tab === 'quickclaims' ? 'block' : 'none';
    document.getElementById('livePricesPanel').style.display = tab === 'liveprices' ? 'block' : 'none';

    const titles = {
        'motorist': 'Pending Motorist Reports',
        'workshop': 'Pending Workshop Listings',
        'live': 'Live Workshop Listings',
        'claims': 'Pending Claim Requests',
        'quickclaims': 'Pending Quick Claims',
        'liveprices': 'Live Price Submissions'
    };
    document.getElementById('sectionTitle').textContent = titles[tab] || 'Pending';
}

async function isCurrentUserAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return false;
    currentAdminEmail = session.user.email;

    const { data: profile, error } = await supabaseClient
        .from('account_profiles')
        .select('is_admin')
        .eq('user_id', session.user.id)
        .single();

    // Fails CLOSED here, deliberately — unlike auth-guard.js elsewhere, an
    // admin page must never grant access on an ambiguous/errored check.
    return !error && !!(profile && profile.is_admin === true);
}

async function checkSession() {
    const isAdmin = await isCurrentUserAdmin();
    if (isAdmin) {
        showRoleChoice();
    }
    // If not admin (including "signed in but not an admin"), the login form
    // stays showing — no session detail is exposed either way (spec 6.1).
}

async function handleLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorBox = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    errorBox.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value,
    });

    if (error) {
        errorBox.textContent = 'Invalid email or password. Please try again.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
        return;
    }

    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
        // Spec 6.1/6.29: a valid login that isn't an administrator account
        // must never reach the dashboard. Sign them back out immediately —
        // don't leave an authenticated-but-unauthorized session sitting active.
        await supabaseClient.auth.signOut();
        errorBox.textContent = 'Invalid email or password. Please try again.';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
        return;
    }

loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
    showRoleChoice();
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    showLogin();
    document.getElementById('loginForm').reset();
}

function showLogin() {
    document.getElementById('roleChoiceView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('partnerView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
}

function showRoleChoice() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('partnerView').classList.add('hidden');
    document.getElementById('roleChoiceView').classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('roleChoiceView').classList.add('hidden');
    document.getElementById('partnerView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');

    const initials = (currentAdminEmail || 'A').slice(0, 2).toUpperCase();
    document.getElementById('adminAvatarToggle').textContent = initials;
    document.getElementById('adminAvatarName').textContent = currentAdminEmail || 'Admin';
}

function showPartnerStub() {
    document.getElementById('roleChoiceView').classList.add('hidden');
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('partnerView').classList.remove('hidden');
}

async function handleAddListing(event) {
    event.preventDefault();
    const errorEl = document.getElementById('addListingError');
    const submitBtn = document.getElementById('addListingSubmitBtn');
    errorEl.style.display = 'none';

    const listing = {
        workshop_name: document.getElementById('alName').value.trim(),
        suburb: document.getElementById('alSuburb').value.trim(),
        city: document.getElementById('alCity').value.trim(),
        province: document.getElementById('alProvince').value,
        contact_number: document.getElementById('alContact').value.trim() || null,
        operating_hours: document.getElementById('alHours').value.trim() || null,
        // Deliberately never collected here — stay empty until the real
        // owner claims the listing and provides them directly.
        physical_address: null,
        specialisation: null,
        guarantee_work: null,
        guarantee_period: null,
        rmi_registered: null,
        written_quote: null,
        email_address: null,
        services: [],
        plan: 'Dominant',
        plan_price: 0,
        user_id: null,
        status: 'Approved',
        source: 'Admin Added'
    };

    if (!listing.workshop_name || !listing.suburb || !listing.city || !listing.province) {
        errorEl.textContent = 'Workshop name, suburb, city, and province are required.';
        errorEl.style.display = 'block';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    const { error } = await supabaseClient.from('Workshopprofiles').insert(listing);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Listing';

    if (error) {
        errorEl.textContent = 'Could not add listing: ' + error.message;
        errorEl.style.display = 'block';
        return;
    }

    document.getElementById('addListingModal').style.display = 'none';
    await loadLiveWorkshopListings();
}

async function loadSuggestions() {
    const body = document.getElementById('suggestionsPanelBody');
    body.innerHTML = '<p style="color:var(--text-secondary);">Loading…</p>';

    const { data, error } = await supabaseClient
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        body.innerHTML = '<p style="color:var(--text-secondary);">Could not load suggestions right now.</p>';
        return;
    }

    if (!data || data.length === 0) {
        body.innerHTML = '<div style="text-align:center;padding:2rem 1rem;color:var(--text-secondary);"><div style="font-size:2rem;margin-bottom:0.75rem;">&#128276;</div><p>No suggestions yet.</p></div>';
        return;
    }

    body.innerHTML = data.map(s => `
        <div style="border-bottom:1px solid var(--border-color); padding:0.75rem 0;">
            <p style="font-size:0.9rem;">${escapeHTML(s.suggestion_text)}</p>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${formatDate(s.created_at)}</span>
        </div>
    `).join('');
}
async function loadAllPending() {
    await Promise.all([loadPendingMotoristSubmissions(), loadPendingWorkshopListings(), loadLiveWorkshopListings(), loadPendingClaimRequests(), loadPendingWorkshopQuickClaims(), loadLivePriceSubmissions()]);
    updateTotalPendingCount();
}
function updateTotalPendingCount() {
    const total = pendingMotoristRecords.length + pendingWorkshopRecords.length + pendingClaimRecords.length + pendingQuickClaimRecords.length;
    const badge = document.getElementById('pendingBellBadge');
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
}

// ─── MOTORIST REPORTS ──────────────────────────────────────────────────────

async function loadPendingMotoristSubmissions() {
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = 'Loading submissions...';
    statusMsg.className = 'status-message status-loading';

    const { data, error } = await supabaseClient
        .from('Submissions')
        .select('*')
        .or('status.is.null,status.eq.Pending')
        .order('id', { ascending: false });

    if (error) {
        statusMsg.textContent = 'Failed to load submissions. Please try refreshing.';
        statusMsg.className = 'status-message status-error';
        return;
    }

    pendingMotoristRecords = data || [];
    if (currentTab === 'motorist') {
        statusMsg.textContent = '';
        statusMsg.className = 'status-message';
    }
    renderMotoristSubmissions();
}

function renderMotoristSubmissions() {
    const tableBody = document.getElementById('submissionsBody');
    const cardsContainer = document.getElementById('submissionsCards');
    const emptyState = document.getElementById('emptyStateMotorist');
    const tableWrap = document.querySelector('#motoristPanel .admin-table-wrap');
    const cardsWrap = document.getElementById('submissionsCards');

    if (pendingMotoristRecords.length === 0) {
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsWrap) cardsWrap.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsWrap) cardsWrap.classList.remove('hidden');

    tableBody.innerHTML = pendingMotoristRecords.map(record => buildMotoristTableRow(record)).join('');
    cardsContainer.innerHTML = pendingMotoristRecords.map(record => buildMotoristCard(record)).join('');

    pendingMotoristRecords.forEach(record => {
        const approveBtns = document.querySelectorAll(`[data-approve-motorist="${record.id}"]`);
        const rejectBtns = document.querySelectorAll(`[data-reject-motorist="${record.id}"]`);
        approveBtns.forEach(btn => btn.addEventListener('click', () => handleMotoristApprove(record.id)));
        rejectBtns.forEach(btn => btn.addEventListener('click', () => handleMotoristReject(record.id)));
    });
}

function buildMotoristTableRow(record) {
    return `
        <tr data-record-id="${record.id}">
            <td data-label="Workshop">${escapeHTML(displayValue(record.workshop_name))}</td>
            <td data-label="Suburb">${escapeHTML(displayValue(record.suburb))}</td>
            <td data-label="Vehicle">${escapeHTML(formatVehicle(record))}</td>
            <td data-label="Repair Type">${escapeHTML(displayValue(record.repair_type))}</td>
            <td data-label="Amount Paid">${formatCurrency(record.amount_paid)}</td>
            <td data-label="Date">${formatDate(record.repair_date)}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-approve" data-approve-motorist="${record.id}">Approve</button>
                    <button class="btn btn-reject" data-reject-motorist="${record.id}">Reject</button>
                </div>
            </td>
        </tr>
    `;
}

function buildMotoristCard(record) {
    return `
        <article class="admin-card" data-record-id="${record.id}">
            <div class="admin-card-header">
                <h3>${escapeHTML(displayValue(record.workshop_name))}</h3>
                <span class="admin-card-date">${formatDate(record.repair_date)}</span>
            </div>
            <div class="admin-card-grid">
                <div class="admin-card-field">
                    <span class="field-label">Suburb</span>
                    <span class="field-value">${escapeHTML(displayValue(record.suburb))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Vehicle</span>
                    <span class="field-value">${escapeHTML(formatVehicle(record))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Repair Type</span>
                    <span class="field-value">${escapeHTML(displayValue(record.repair_type))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Amount Paid</span>
                    <span class="field-value">${formatCurrency(record.amount_paid)}</span>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-approve" data-approve-motorist="${record.id}">Approve</button>
                <button class="btn btn-reject" data-reject-motorist="${record.id}">Reject</button>
            </div>
        </article>
    `;
}

async function handleMotoristApprove(id) {
    await updateMotoristStatus(id, 'Approved');
}

async function handleMotoristReject(id) {
    await updateMotoristStatus(id, 'Rejected');
}

async function updateMotoristStatus(id, newStatus) {
    const buttons = document.querySelectorAll(`[data-approve-motorist="${id}"], [data-reject-motorist="${id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    const { error } = await supabaseClient
        .from('Submissions')
        .update({ status: newStatus })
        .eq('id', id);

    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = `Failed to ${newStatus.toLowerCase()} submission. Please try again.`;
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

    removeRecordFromView(id);
    pendingMotoristRecords = pendingMotoristRecords.filter(r => r.id !== id);
    updateTotalPendingCount();

    if (pendingMotoristRecords.length === 0) {
        document.querySelector('#motoristPanel .admin-table-wrap').classList.add('hidden');
        document.getElementById('submissionsCards').classList.add('hidden');
        document.getElementById('emptyStateMotorist').classList.remove('hidden');
    }
}

// ─── LIVE PRICE SUBMISSIONS ─────────────────────────────────────────────────

async function loadLivePriceSubmissions() {
    const { data, error } = await supabaseClient
        .from('Submissions')
        .select('*')
        .eq('status', 'Approved')
        .order('id', { ascending: false });

    if (error) {
        console.error('Failed to load live price submissions:', error);
        return;
    }

    livePriceRecords = data || [];
    renderLivePriceSubmissions();
}

function renderLivePriceSubmissions() {
    const tableBody = document.getElementById('livePricesBody');
    const cardsContainer = document.getElementById('livePricesCards');
    const emptyState = document.getElementById('emptyStateLivePrices');
    const tableWrap = document.getElementById('livePricesTableWrap');

    if (livePriceRecords.length === 0) {
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsContainer) cardsContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsContainer) cardsContainer.classList.remove('hidden');

    tableBody.innerHTML = livePriceRecords.map(record => buildLivePriceTableRow(record)).join('');
    cardsContainer.innerHTML = livePriceRecords.map(record => buildLivePriceCard(record)).join('');

    livePriceRecords.forEach(record => {
        const deleteBtns = document.querySelectorAll(`[data-delete-price="${record.id}"]`);
        deleteBtns.forEach(btn => btn.addEventListener('click', () => handleSubmissionDelete(record.id)));
    });
}

function buildLivePriceTableRow(record) {
    return `
        <tr data-price-id="${record.id}">
            <td data-label="Workshop">${escapeHTML(displayValue(record.workshop_name))}</td>
            <td data-label="Suburb">${escapeHTML(displayValue(record.suburb))}</td>
            <td data-label="Vehicle">${escapeHTML(formatVehicle(record))}</td>
            <td data-label="Repair Type">${escapeHTML(displayValue(record.repair_type))}</td>
            <td data-label="Amount Paid">${formatCurrency(record.amount_paid)}</td>
            <td data-label="Date">${formatDate(record.repair_date)}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-reject" data-delete-price="${record.id}">Delete</button>
                </div>
            </td>
        </tr>
    `;
}

function buildLivePriceCard(record) {
    return `
        <article class="admin-card" data-price-id="${record.id}">
            <div class="admin-card-header">
                <h3>${escapeHTML(displayValue(record.workshop_name))}</h3>
                <span class="admin-card-date">${formatDate(record.repair_date)}</span>
            </div>
            <div class="admin-card-grid">
                <div class="admin-card-field">
                    <span class="field-label">Suburb</span>
                    <span class="field-value">${escapeHTML(displayValue(record.suburb))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Vehicle</span>
                    <span class="field-value">${escapeHTML(formatVehicle(record))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Repair Type</span>
                    <span class="field-value">${escapeHTML(displayValue(record.repair_type))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Amount Paid</span>
                    <span class="field-value">${formatCurrency(record.amount_paid)}</span>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-reject" data-delete-price="${record.id}">Delete</button>
            </div>
        </article>
    `;
}

async function handleSubmissionDelete(id) {
    if (!confirm('Are you sure you want to delete this price submission? This cannot be undone.')) {
        return;
    }

    const buttons = document.querySelectorAll(`[data-delete-price="${id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    const { error } = await supabaseClient
        .from('Submissions')
        .delete()
        .eq('id', id);

    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to delete submission. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

    document.querySelectorAll(`[data-price-id="${id}"]`).forEach(el => {
        el.classList.add('row-removing');
        setTimeout(() => el.remove(), 300);
    });
    livePriceRecords = livePriceRecords.filter(r => r.id !== id);

    if (livePriceRecords.length === 0 && currentTab === 'liveprices') {
        document.getElementById('livePricesTableWrap').classList.add('hidden');
        document.getElementById('livePricesCards').classList.add('hidden');
        document.getElementById('emptyStateLivePrices').classList.remove('hidden');
    }
}

// ─── WORKSHOP LISTINGS ──────────────────────────────────────────────────────
async function loadPendingWorkshopListings() {
    const { data, error } = await supabaseClient
        .from('Workshopprofiles')
        .select('*')
        .eq('status', 'Pending')
        .order('id', { ascending: false });

    if (error) {
        console.error('Failed to load workshop listings:', error);
        return;
    }

    pendingWorkshopRecords = data || [];
    renderWorkshopListings();
}

function renderWorkshopListings() {
    const tableBody = document.getElementById('workshopBody');
    const cardsContainer = document.getElementById('workshopCards');
    const emptyState = document.getElementById('emptyStateWorkshop');
    const tableWrap = document.getElementById('workshopTableWrap');

    if (pendingWorkshopRecords.length === 0) {
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsContainer) cardsContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsContainer) cardsContainer.classList.remove('hidden');

    tableBody.innerHTML = pendingWorkshopRecords.map(record => buildWorkshopTableRow(record)).join('');
    cardsContainer.innerHTML = pendingWorkshopRecords.map(record => buildWorkshopCard(record)).join('');

    pendingWorkshopRecords.forEach(record => {
        const approveBtns = document.querySelectorAll(`[data-approve-workshop="${record.id}"]`);
        const deleteBtns = document.querySelectorAll(`[data-delete-workshop="${record.id}"]`);
        approveBtns.forEach(btn => btn.addEventListener('click', () => handleWorkshopApprove(record.id)));
        deleteBtns.forEach(btn => btn.addEventListener('click', () => handleWorkshopDelete(record.id)));
    });
}

async function loadLiveWorkshopListings() {
    const { data, error } = await supabaseClient
        .from('Workshopprofiles')
        .select('*')
        .eq('status', 'Approved')
        .order('id', { ascending: false });

    if (error) {
        console.error('Failed to load live workshop listings:', error);
        return;
    }

    liveWorkshopRecords = data || [];
    renderLiveWorkshopListings();
}

function renderLiveWorkshopListings() {
    const tableBody = document.getElementById('liveWorkshopBody');
    const cardsContainer = document.getElementById('liveWorkshopCards');
    const emptyState = document.getElementById('emptyStateLiveWorkshop');
    const tableWrap = document.getElementById('liveWorkshopTableWrap');

    if (liveWorkshopRecords.length === 0) {
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsContainer) cardsContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsContainer) cardsContainer.classList.remove('hidden');

    tableBody.innerHTML = liveWorkshopRecords.map(record => buildLiveWorkshopTableRow(record)).join('');
    cardsContainer.innerHTML = liveWorkshopRecords.map(record => buildLiveWorkshopCard(record)).join('');

    liveWorkshopRecords.forEach(record => {
        const deleteBtns = document.querySelectorAll(`[data-delete-live-workshop="${record.id}"]`);
        deleteBtns.forEach(btn => btn.addEventListener('click', () => handleWorkshopDelete(record.id)));
    });
}

function buildLiveWorkshopTableRow(record) {
    const location = [record.suburb, record.city, record.province].filter(Boolean).join(', ');
    return `
        <tr data-workshop-id="${record.id}">
            <td data-label="Workshop">${escapeHTML(displayValue(record.workshop_name))}</td>
            <td data-label="Location">${escapeHTML(displayValue(location))}</td>
            <td data-label="Contact">${escapeHTML(displayValue(record.contact_number))}</td>
            <td data-label="Specialisation">${escapeHTML(displayValue(record.specialisation))}</td>
            <td data-label="Email">${escapeHTML(displayValue(record.email_address))}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-reject" data-delete-live-workshop="${record.id}">Delete</button>
                </div>
            </td>
        </tr>
    `;
}

function buildLiveWorkshopCard(record) {
    const location = [record.suburb, record.city, record.province].filter(Boolean).join(', ');
    return `
        <article class="admin-card" data-workshop-id="${record.id}">
            <div class="admin-card-header">
                <h3>${escapeHTML(displayValue(record.workshop_name))}</h3>
            </div>
            <div class="admin-card-grid">
                <div class="admin-card-field">
                    <span class="field-label">Location</span>
                    <span class="field-value">${escapeHTML(displayValue(location))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Contact</span>
                    <span class="field-value">${escapeHTML(displayValue(record.contact_number))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Specialisation</span>
                    <span class="field-value">${escapeHTML(displayValue(record.specialisation))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Email</span>
                    <span class="field-value">${escapeHTML(displayValue(record.email_address))}</span>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-reject" data-delete-live-workshop="${record.id}">Delete</button>
            </div>
        </article>
    `;
}

function buildWorkshopTableRow(record) {
    const location = [record.suburb, record.city, record.province].filter(Boolean).join(', ');
    return `
        <tr data-workshop-id="${record.id}">
            <td data-label="Workshop">${escapeHTML(displayValue(record.workshop_name))}</td>
            <td data-label="Location">${escapeHTML(displayValue(location))}</td>
            <td data-label="Contact">${escapeHTML(displayValue(record.contact_number))}</td>
            <td data-label="Specialisation">${escapeHTML(displayValue(record.specialisation))}</td>
            <td data-label="Email">${escapeHTML(displayValue(record.email_address))}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-approve" data-approve-workshop="${record.id}">Approve</button>
                    <button class="btn btn-reject" data-delete-workshop="${record.id}">Delete</button>
                </div>
            </td>
        </tr>
    `;
}

function buildWorkshopCard(record) {
    const location = [record.suburb, record.city, record.province].filter(Boolean).join(', ');
    return `
        <article class="admin-card" data-workshop-id="${record.id}">
            <div class="admin-card-header">
                <h3>${escapeHTML(displayValue(record.workshop_name))}</h3>
            </div>
            <div class="admin-card-grid">
                <div class="admin-card-field">
                    <span class="field-label">Location</span>
                    <span class="field-value">${escapeHTML(displayValue(location))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Contact</span>
                    <span class="field-value">${escapeHTML(displayValue(record.contact_number))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Specialisation</span>
                    <span class="field-value">${escapeHTML(displayValue(record.specialisation))}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Email</span>
                    <span class="field-value">${escapeHTML(displayValue(record.email_address))}</span>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-approve" data-approve-workshop="${record.id}">Approve</button>
                <button class="btn btn-reject" data-delete-workshop="${record.id}">Delete</button>
            </div>
        </article>
    `;
}

async function handleWorkshopApprove(id) {
    const buttons = document.querySelectorAll(`[data-approve-workshop="${id}"], [data-delete-workshop="${id}"]`);
    buttons.forEach(btn => btn.disabled = true);

 const { data, error } = await supabaseClient
    .from('Workshopprofiles')
    .update({ status: 'Approved' })
    .eq('id', id)
    .select();

if (error || !data || data.length === 0) {
    alert('Workshop approval failed. No rows were updated.');
    return;
}

supabaseClient.from('notifications').insert({
    workshop_id: id,
    message: 'Your listing "' + data[0].workshop_name + '" has been approved and is now live.',
    link: 'my-listing.html'
}).then(({ error: notifErr }) => {
    if (notifErr) console.error('Failed to send approval notification:', notifErr);
});

removeWorkshopFromView(id);
    pendingWorkshopRecords = pendingWorkshopRecords.filter(r => r.id !== id);
    updateTotalPendingCount();

    if (pendingWorkshopRecords.length === 0) {
        document.getElementById('workshopTableWrap').classList.add('hidden');
        document.getElementById('workshopCards').classList.add('hidden');
        document.getElementById('emptyStateWorkshop').classList.remove('hidden');
    }
}

async function handleWorkshopDelete(id) {
    if (!confirm('Are you sure you want to delete this workshop listing? This cannot be undone.')) {
        return;
    }

    const buttons = document.querySelectorAll(`[data-approve-workshop="${id}"], [data-delete-workshop="${id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    const record = pendingWorkshopRecords.find(r => r.id === id) || liveWorkshopRecords.find(r => r.id === id);
    if (record) {
        // Sent before deleting — once the listing row is gone there is
        // nothing left for this notification to reference.
        await supabaseClient.from('notifications').insert({
            workshop_id: id,
            message: 'Your listing "' + record.workshop_name + '" has been removed by the administrator.'
        }).then(({ error: notifErr }) => {
            if (notifErr) console.error('Failed to send deletion notification:', notifErr);
        });
    }

    const { error } = await supabaseClient
        .from('Workshopprofiles')
        .delete()
        .eq('id', id);
    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to delete workshop. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

removeWorkshopFromView(id);
    pendingWorkshopRecords = pendingWorkshopRecords.filter(r => r.id !== id);
    liveWorkshopRecords = liveWorkshopRecords.filter(r => r.id !== id);
    updateTotalPendingCount();

    if (pendingWorkshopRecords.length === 0 && currentTab === 'workshop') {
        document.getElementById('workshopTableWrap').classList.add('hidden');
        document.getElementById('workshopCards').classList.add('hidden');
        document.getElementById('emptyStateWorkshop').classList.remove('hidden');
    }

    if (liveWorkshopRecords.length === 0 && currentTab === 'live') {
        document.getElementById('liveWorkshopTableWrap').classList.add('hidden');
        document.getElementById('liveWorkshopCards').classList.add('hidden');
        document.getElementById('emptyStateLiveWorkshop').classList.remove('hidden');
    }
}

// ─── CLAIM REQUESTS ──────────────────────────────────────────────────────────

async function loadPendingClaimRequests() {
    const { data, error } = await supabaseClient
        .from('claim_requests')
        .select(`
            id,
            created_at,
            workshop_id,
            user_id,
            contact_person,
            role,
            business_phone,
            signboard_photo_url,
            interior_photo_url,
            document_url,
            notes,
            status,
            Workshopprofiles ( workshop_name, suburb, city, province )
        `)
        .eq('status', 'Pending')
        .order('id', { ascending: false });

    if (error) {
        console.error('Failed to load claim requests:', error);
        return;
    }

    pendingClaimRecords = data || [];
    renderClaimRequests();
}

function renderClaimRequests() {
    const tableBody = document.getElementById('claimsBody');
    const cardsContainer = document.getElementById('claimsCards');
    const emptyState = document.getElementById('emptyStateClaims');
    const tableWrap = document.getElementById('claimsTableWrap');
    const cardsWrap = document.getElementById('claimsCards');

    if (pendingClaimRecords.length === 0) {
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsWrap) cardsWrap.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsWrap) cardsWrap.classList.remove('hidden');

    tableBody.innerHTML = pendingClaimRecords.map(record => buildClaimTableRow(record)).join('');
    cardsContainer.innerHTML = pendingClaimRecords.map(record => buildClaimCard(record)).join('');

    pendingClaimRecords.forEach(record => {
        const approveBtns = document.querySelectorAll(`[data-approve-claim="${record.id}"]`);
        const rejectBtns = document.querySelectorAll(`[data-reject-claim="${record.id}"]`);
        approveBtns.forEach(btn => btn.addEventListener('click', () => handleClaimApprove(record)));
        rejectBtns.forEach(btn => btn.addEventListener('click', () => handleClaimReject(record)));
    });
}

function buildClaimTableRow(record) {
    const ws = record.Workshopprofiles || {};
    const workshopName = ws.workshop_name || 'Unknown';
    const location = [ws.suburb, ws.city].filter(Boolean).join(', ') || 'Location unknown';
    const evidenceLinks = [];
    if (record.signboard_photo_url) evidenceLinks.push(`<a href="${escapeHTML(record.signboard_photo_url)}" target="_blank" style="color:var(--primary-accent);text-decoration:underline;">Signboard</a>`);
    if (record.interior_photo_url) evidenceLinks.push(`<a href="${escapeHTML(record.interior_photo_url)}" target="_blank" style="color:var(--primary-accent);text-decoration:underline;">Interior</a>`);
    if (record.document_url) evidenceLinks.push(`<a href="${escapeHTML(record.document_url)}" target="_blank" style="color:var(--primary-accent);text-decoration:underline;">Document</a>`);
    const evidenceHtml = evidenceLinks.length > 0 ? evidenceLinks.join(' | ') : 'None';

    return `
        <tr data-claim-id="${record.id}">
            <td data-label="Workshop">
                <strong>${escapeHTML(workshopName)}</strong><br>
                <span style="color:var(--text-secondary);font-size:0.85rem;">${escapeHTML(location)}</span>
            </td>
            <td data-label="Claimant">${escapeHTML(record.contact_person)}</td>
            <td data-label="Role">${escapeHTML(record.role || 'Unspecified')}</td>
            <td data-label="Phone">${escapeHTML(record.business_phone)}</td>
            <td data-label="Evidence">${evidenceHtml}</td>
            <td data-label="Submitted">${formatDate(record.created_at)}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-approve" data-approve-claim="${record.id}">Approve</button>
                    <button class="btn btn-reject" data-reject-claim="${record.id}">Reject</button>
                </div>
            </td>
        </tr>
    `;
}

function buildClaimCard(record) {
    const ws = record.Workshopprofiles || {};
    const workshopName = ws.workshop_name || 'Unknown';
    const location = [ws.suburb, ws.city, ws.province].filter(Boolean).join(', ') || 'Location unknown';
    const evidenceLinks = [];
    if (record.signboard_photo_url) evidenceLinks.push(`<a href="${escapeHTML(record.signboard_photo_url)}" target="_blank" style="color:var(--primary-accent);text-decoration:underline;">Signboard</a>`);
    if (record.interior_photo_url) evidenceLinks.push(`<a href="${escapeHTML(record.interior_photo_url)}" target="_blank" style="color:var(--primary-accent);text-decoration:underline;">Interior</a>`);
    if (record.document_url) evidenceLinks.push(`<a href="${escapeHTML(record.document_url)}" target="_blank" style="color:var(--primary-accent);text-decoration:underline;">Document</a>`);
    const evidenceHtml = evidenceLinks.length > 0 ? evidenceLinks.join(' | ') : 'None';

    return `
        <article class="admin-card" data-claim-id="${record.id}">
            <div class="admin-card-header">
                <h3>${escapeHTML(workshopName)}</h3>
                <span class="admin-card-date">${formatDate(record.created_at)}</span>
            </div>
            <div class="admin-card-grid">
                <div class="admin-card-field">
                    <span class="field-label">Location</span>
                    <span class="field-value">${escapeHTML(location)}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Claimant</span>
                    <span class="field-value">${escapeHTML(record.contact_person)}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Role</span>
                    <span class="field-value">${escapeHTML(record.role || 'Unspecified')}</span>
                </div>
                <div class="admin-card-field">
                    <span class="field-label">Phone</span>
                    <span class="field-value">${escapeHTML(record.business_phone)}</span>
                </div>
                <div class="admin-card-field" style="grid-column:1/-1;">
                    <span class="field-label">Evidence</span>
                    <span class="field-value">${evidenceHtml}</span>
                </div>
                ${record.notes ? `
                <div class="admin-card-field" style="grid-column:1/-1;">
                    <span class="field-label">Notes</span>
                    <span class="field-value">${escapeHTML(record.notes)}</span>
                </div>
                ` : ''}
            </div>
            <div class="action-buttons">
                <button class="btn btn-approve" data-approve-claim="${record.id}">Approve</button>
                <button class="btn btn-reject" data-reject-claim="${record.id}">Reject</button>
            </div>
        </article>
    `;
}

async function handleClaimApprove(record) {
    const buttons = document.querySelectorAll(`[data-approve-claim="${record.id}"], [data-reject-claim="${record.id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    // Update claim request status
    const { error: claimError } = await supabaseClient
        .from('claim_requests')
        .update({ status: 'Approved' })
        .eq('id', record.id);

    if (claimError) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to approve claim. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

    // Update workshop with user_id and status
    const { error: workshopError } = await supabaseClient
        .from('Workshopprofiles')
        .update({
            user_id: record.user_id,
            status: 'Approved',
            source: 'Claimed by Workshop'
        })
        .eq('id', record.workshop_id);

    if (workshopError) {
        console.error('Failed to update workshop:', workshopError);
    }

    removeClaimFromView(record.id);
    pendingClaimRecords = pendingClaimRecords.filter(r => r.id !== record.id);
    updateTotalPendingCount();

    if (pendingClaimRecords.length === 0) {
        document.getElementById('claimsTableWrap').classList.add('hidden');
        document.getElementById('claimsCards').classList.add('hidden');
        document.getElementById('emptyStateClaims').classList.remove('hidden');
    }
}

async function handleClaimReject(record) {
    if (!confirm('Are you sure you want to reject this claim request?')) {
        return;
    }

    const buttons = document.querySelectorAll(`[data-approve-claim="${record.id}"], [data-reject-claim="${record.id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    // Update claim request status
    const { error } = await supabaseClient
        .from('claim_requests')
        .update({ status: 'Rejected' })
        .eq('id', record.id);

    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to reject claim. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

    // Reset workshop status from Claim Pending back to Approved
    await supabaseClient
        .from('Workshopprofiles')
        .update({ status: 'Approved' })
        .eq('id', record.workshop_id);

    removeClaimFromView(record.id);
    pendingClaimRecords = pendingClaimRecords.filter(r => r.id !== record.id);
    updateTotalPendingCount();

    if (pendingClaimRecords.length === 0) {
        document.getElementById('claimsTableWrap').classList.add('hidden');
        document.getElementById('claimsCards').classList.add('hidden');
        document.getElementById('emptyStateClaims').classList.remove('hidden');
    }
}

function removeClaimFromView(id) {
    const elements = document.querySelectorAll(`[data-claim-id="${id}"]`);
    elements.forEach(el => {
        el.classList.add('row-removing');
        setTimeout(() => el.remove(), 300);
    });
}

// ─── QUICK CLAIMS (Prices page "Is this your workshop?" modal) ────────────

async function loadPendingWorkshopQuickClaims() {
    const { data, error } = await supabaseClient
        .from('workshop_claims')
        .select('id, created_at, workshop_name, contact_email, message, status')
        .eq('status', 'Pending')
        .order('id', { ascending: false });

    if (error) {
        console.error('Failed to load quick claims:', error);
        return;
    }

    pendingQuickClaimRecords = data || [];
    renderWorkshopQuickClaims();
}

function renderWorkshopQuickClaims() {
    const tableBody = document.getElementById('quickClaimsBody');
    const cardsContainer = document.getElementById('quickClaimsCards');
    const emptyState = document.getElementById('emptyStateQuickClaims');
    const tableWrap = document.getElementById('quickClaimsTableWrap');
    const cardsWrap = document.getElementById('quickClaimsCards');

    if (pendingQuickClaimRecords.length === 0) {
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsWrap) cardsWrap.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (cardsWrap) cardsWrap.classList.remove('hidden');

    tableBody.innerHTML = pendingQuickClaimRecords.map(record => buildQuickClaimTableRow(record)).join('');
    cardsContainer.innerHTML = pendingQuickClaimRecords.map(record => buildQuickClaimCard(record)).join('');

    pendingQuickClaimRecords.forEach(record => {
        const approveBtns = document.querySelectorAll(`[data-approve-quickclaim="${record.id}"]`);
        const rejectBtns = document.querySelectorAll(`[data-reject-quickclaim="${record.id}"]`);
        approveBtns.forEach(btn => btn.addEventListener('click', () => handleQuickClaimApprove(record)));
        rejectBtns.forEach(btn => btn.addEventListener('click', () => handleQuickClaimReject(record)));
    });
}

function buildQuickClaimTableRow(record) {
    return `
        <tr data-quickclaim-id="${record.id}">
            <td data-label="Workshop"><strong>${escapeHTML(record.workshop_name || 'Unknown')}</strong></td>
            <td data-label="Contact Email">${escapeHTML(record.contact_email)}</td>
            <td data-label="Message">${escapeHTML(record.message || 'No message provided')}</td>
            <td data-label="Submitted">${formatDate(record.created_at)}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-approve" data-approve-quickclaim="${record.id}">Approve</button>
                    <button class="btn btn-reject" data-reject-quickclaim="${record.id}">Reject</button>
                </div>
            </td>
        </tr>
    `;
}

function buildQuickClaimCard(record) {
    return `
        <article class="admin-card" data-quickclaim-id="${record.id}">
            <div class="admin-card-header">
                <h3>${escapeHTML(record.workshop_name || 'Unknown')}</h3>
                <span class="admin-card-date">${formatDate(record.created_at)}</span>
            </div>
            <div class="admin-card-grid">
                <div class="admin-card-field" style="grid-column:1/-1;">
                    <span class="field-label">Contact Email</span>
                    <span class="field-value">${escapeHTML(record.contact_email)}</span>
                </div>
                <div class="admin-card-field" style="grid-column:1/-1;">
                    <span class="field-label">Message</span>
                    <span class="field-value">${escapeHTML(record.message || 'No message provided')}</span>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-approve" data-approve-quickclaim="${record.id}">Approve</button>
                <button class="btn btn-reject" data-reject-quickclaim="${record.id}">Reject</button>
            </div>
        </article>
    `;
}

async function handleQuickClaimApprove(record) {
    const buttons = document.querySelectorAll(`[data-approve-quickclaim="${record.id}"], [data-reject-quickclaim="${record.id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    const { error } = await supabaseClient
        .from('workshop_claims')
        .update({ status: 'Approved' })
        .eq('id', record.id);

    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to approve quick claim. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

    removeQuickClaimFromView(record.id);
    pendingQuickClaimRecords = pendingQuickClaimRecords.filter(r => r.id !== record.id);
    updateTotalPendingCount();

    if (pendingQuickClaimRecords.length === 0) {
        document.getElementById('quickClaimsTableWrap').classList.add('hidden');
        document.getElementById('quickClaimsCards').classList.add('hidden');
        document.getElementById('emptyStateQuickClaims').classList.remove('hidden');
    }
}

async function handleQuickClaimReject(record) {
    if (!confirm('Are you sure you want to reject this quick claim?')) {
        return;
    }

    const buttons = document.querySelectorAll(`[data-approve-quickclaim="${record.id}"], [data-reject-quickclaim="${record.id}"]`);
    buttons.forEach(btn => btn.disabled = true);

    const { error } = await supabaseClient
        .from('workshop_claims')
        .update({ status: 'Rejected' })
        .eq('id', record.id);

    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to reject quick claim. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

    removeQuickClaimFromView(record.id);
    pendingQuickClaimRecords = pendingQuickClaimRecords.filter(r => r.id !== record.id);
    updateTotalPendingCount();

    if (pendingQuickClaimRecords.length === 0) {
        document.getElementById('quickClaimsTableWrap').classList.add('hidden');
        document.getElementById('quickClaimsCards').classList.add('hidden');
        document.getElementById('emptyStateQuickClaims').classList.remove('hidden');
    }
}

function removeQuickClaimFromView(id) {
    const elements = document.querySelectorAll(`[data-quickclaim-id="${id}"]`);
    elements.forEach(el => {
        el.classList.add('row-removing');
        setTimeout(() => el.remove(), 300);
    });
}

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────────

function removeRecordFromView(id) {
    const elements = document.querySelectorAll(`[data-record-id="${id}"]`);
    elements.forEach(el => {
        el.classList.add('row-removing');
        setTimeout(() => el.remove(), 300);
    });
}

function removeWorkshopFromView(id) {
    const elements = document.querySelectorAll(`[data-workshop-id="${id}"]`);
    elements.forEach(el => {
        el.classList.add('row-removing');
        setTimeout(() => el.remove(), 300);
    });
}

function displayValue(value) {
    if (value === null || value === undefined || value === '') return 'Unspecified';
    return value;
}

function formatVehicle(record) {
    const make = record.car_make;
    const model = record.car_model;
    if (!make && !model) return 'Unspecified';
    return [make, model].filter(v => v).join(' ') || 'Unspecified';
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return 'Unspecified';
    const num = parseFloat(amount);
    if (isNaN(num)) return 'Unspecified';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return 'Unspecified';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unspecified';
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHTML(unsafe) {
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
