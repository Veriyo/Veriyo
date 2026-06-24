/**
 * Veriyo Partner Dashboard
 * Read-only aggregate performance metrics behind Supabase Auth.
 * No individual motorist PII or row-level data is ever displayed.
 */

const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    checkSession();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showDashboard();
        await loadMetrics();
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

    const { error } = await supabaseClient.auth.signInWithPassword({
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
    await loadMetrics();
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

async function loadMetrics() {
    const loadStatus = document.getElementById('loadStatus');
    loadStatus.textContent = 'Loading metrics...';
    loadStatus.className = 'partner-load-status';

    try {
        const [submissionsRes, workshopsRes, suburbsRes] = await Promise.all([
            supabaseClient.from('Submissions').select('suburb').eq('status', 'Approved'),
            supabaseClient.from('Workshopprofiles').select('status').in('status', ['Active', 'Approved']),
            supabaseClient.from('Submissions').select('suburb').not('suburb', 'is', null).neq('suburb', ''),
        ]);

        if (submissionsRes.error) throw submissionsRes.error;
        if (workshopsRes.error) throw workshopsRes.error;
        if (suburbsRes.error) throw suburbsRes.error;

        const totalSubmissions = submissionsRes.data.length;
        const activeWorkshops = workshopsRes.data.length;

        const uniqueSuburbs = new Set(
            suburbsRes.data.map(r => (r.suburb || '').trim().toLowerCase()).filter(Boolean)
        );
        const regionalReach = uniqueSuburbs.size;

        animateCounter('totalSubmissions', totalSubmissions);
        animateCounter('activeWorkshops', activeWorkshops);
        animateCounter('regionalReach', regionalReach);

        renderTopSuburbs(suburbsRes.data);

        loadStatus.textContent = '';
        loadStatus.className = 'partner-load-status hidden';
    } catch (err) {
        loadStatus.textContent = 'Failed to load metrics. Please try logging in again.';
        loadStatus.className = 'partner-load-status partner-load-error';
    }
}

function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    const duration = 900;
    const startTime = performance.now();

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-ZA');
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString('en-ZA');
    }

    requestAnimationFrame(tick);
}

function renderTopSuburbs(rows) {
    const container = document.getElementById('suburbsList');
    const counts = {};

    rows.forEach(r => {
        const name = (r.suburb || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        counts[key] = { display: name, count: (counts[key]?.count || 0) + 1 };
    });

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="partner-no-suburbs">No suburb engagement data available yet.</p>';
        return;
    }

    const maxCount = sorted[0].count;

    container.innerHTML = sorted.map((entry, idx) => {
        const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
        return `
            <div class="partner-suburb-row">
                <span class="partner-suburb-rank">${idx + 1}</span>
                <span class="partner-suburb-name">${escapeHTML(entry.display)}</span>
                <div class="partner-suburb-bar-track">
                    <div class="partner-suburb-bar-fill" style="width: ${barWidth}%"></div>
                </div>
                <span class="partner-suburb-count">${entry.count}</span>
            </div>
        `;
    }).join('');
}

function escapeHTML(unsafe) {
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
