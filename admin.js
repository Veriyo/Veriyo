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
let currentTab = 'motorist';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    refreshBtn.addEventListener('click', () => loadAllPending());

    // Tab switching
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
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

    document.getElementById('motoristPanel').style.display = tab === 'motorist' ? 'block' : 'none';
    document.getElementById('workshopPanel').style.display = tab === 'workshop' ? 'block' : 'none';
    document.getElementById('sectionTitle').textContent = tab === 'motorist' ? 'Pending Motorist Reports' : 'Pending Workshop Listings';
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showDashboard();
        await loadAllPending();
    }
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

    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
    showDashboard();
    await loadAllPending();
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    showLogin();
    document.getElementById('loginForm').reset();
}

function showLogin() {
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
}

async function loadAllPending() {
    await Promise.all([loadPendingMotoristSubmissions(), loadPendingWorkshopListings()]);
    updateTotalPendingCount();
}

function updateTotalPendingCount() {
    const total = pendingMotoristRecords.length + pendingWorkshopRecords.length;
    document.getElementById('pendingCount').textContent = total;
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

    const { error } = await supabaseClient
        .from('Workshopprofiles')
        .update({ status: 'Approved' })
        .eq('id', id);

    if (error) {
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'Failed to approve workshop. Please try again.';
        statusMsg.className = 'status-message status-error';
        buttons.forEach(btn => btn.disabled = false);
        return;
    }

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
    updateTotalPendingCount();

    if (pendingWorkshopRecords.length === 0) {
        document.getElementById('workshopTableWrap').classList.add('hidden');
        document.getElementById('workshopCards').classList.add('hidden');
        document.getElementById('emptyStateWorkshop').classList.remove('hidden');
    }
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
