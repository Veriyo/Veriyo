/**
 * Veriyo Admin Dashboard
 * Supabase Auth + Submission moderation (approve / reject)
 */

const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let pendingRecords = [];

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    refreshBtn.addEventListener('click', () => loadPendingSubmissions());

    checkSession();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showDashboard();
        await loadPendingSubmissions();
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
    await loadPendingSubmissions();
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

async function loadPendingSubmissions() {
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

    pendingRecords = data || [];
    statusMsg.textContent = '';
    statusMsg.className = 'status-message';
    renderSubmissions();
}

function renderSubmissions() {
    const tableBody = document.getElementById('submissionsBody');
    const cardsContainer = document.getElementById('submissionsCards');
    const emptyState = document.getElementById('emptyState');
    const tableWrap = document.querySelector('.admin-table-wrap');
    const countEl = document.getElementById('pendingCount');

    countEl.textContent = pendingRecords.length;

    if (pendingRecords.length === 0) {
        tableWrap.classList.add('hidden');
        cardsContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tableWrap.classList.remove('hidden');
    cardsContainer.classList.remove('hidden');

    tableBody.innerHTML = pendingRecords.map(record => buildTableRow(record)).join('');
    cardsContainer.innerHTML = pendingRecords.map(record => buildCard(record)).join('');

    pendingRecords.forEach(record => {
        const approveBtns = document.querySelectorAll(`[data-approve="${record.id}"]`);
        const rejectBtns = document.querySelectorAll(`[data-reject="${record.id}"]`);
        approveBtns.forEach(btn => btn.addEventListener('click', () => handleApprove(record.id)));
        rejectBtns.forEach(btn => btn.addEventListener('click', () => handleReject(record.id)));
    });
}

function buildTableRow(record) {
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
                    <button class="btn btn-approve" data-approve="${record.id}">Approve</button>
                    <button class="btn btn-reject" data-reject="${record.id}">Reject</button>
                </div>
            </td>
        </tr>
    `;
}

function buildCard(record) {
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
                <button class="btn btn-approve" data-approve="${record.id}">Approve</button>
                <button class="btn btn-reject" data-reject="${record.id}">Reject</button>
            </div>
        </article>
    `;
}

async function handleApprove(id) {
    await updateStatus(id, 'Approved');
}

async function handleReject(id) {
    await updateStatus(id, 'Rejected');
}

async function updateStatus(id, newStatus) {
    const buttons = document.querySelectorAll(`[data-approve="${id}"], [data-reject="${id}"]`);
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
    pendingRecords = pendingRecords.filter(r => r.id !== id);
    document.getElementById('pendingCount').textContent = pendingRecords.length;

    if (pendingRecords.length === 0) {
        document.querySelector('.admin-table-wrap').classList.add('hidden');
        document.getElementById('submissionsCards').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
    }
}

function removeRecordFromView(id) {
    const elements = document.querySelectorAll(`[data-record-id="${id}"]`);
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
