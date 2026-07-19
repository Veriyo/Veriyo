/**
 * Veriyo Partner Portal
 * Full partner workspace: tasks, dashboard, referral, handbook, resources, support
 */

const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentPartner = null;
let currentSession = null;
let allTasks = [];
let completedTaskIds = new Set();
let todayReportSubmitted = false;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutNotApprovedBtn').addEventListener('click', handleLogout);
    document.getElementById('logoutTrialBtn').addEventListener('click', handleLogout);
    document.getElementById('portalLogoutBtn').addEventListener('click', handleLogout);
    document.getElementById('continuePartnerBtn').addEventListener('click', handleContinueTrial);
    document.getElementById('leaveProgrammeBtn').addEventListener('click', handleLeaveProgramme);
    document.getElementById('copyReferralBtn').addEventListener('click', copyReferralLink);
    document.getElementById('activityReportForm').addEventListener('submit', handleActivityReport);
    document.getElementById('supportForm').addEventListener('submit', handleSupportRequest);
document.getElementById('switchToSupportBtn').addEventListener('click', () => showTab('support'));
document.getElementById('switchToChatBtn').addEventListener('click', () => showTab('chat'));
document.getElementById('partnerChatIconBtn').addEventListener('click', () => showTab('chat'));

document.getElementById('earningsHowItWorksBtn').addEventListener('click', () => showTab('earnings-info'));
    document.getElementById('backToDashboardFromEarningsBtn').addEventListener('click', () => showTab('dashboard'));

    document.getElementById('viewRecruitedWorkshopsBtn').addEventListener('click', () => {
        showTab('workshops');
        loadRecruitedWorkshops();
    });
    document.getElementById('backToDashboardBtn').addEventListener('click', () => showTab('dashboard'));


document.querySelectorAll('.partner-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showTab(btn.dataset.tab);
            document.getElementById('navMenuDropdown').style.display = 'none';
        });
    });

    document.getElementById('navMenuToggle').addEventListener('click', () => {
        const menu = document.getElementById('navMenuDropdown');
        const isOpen = menu.style.display !== 'none';
        menu.style.display = isOpen ? 'none' : 'flex';
        document.getElementById('navMenuToggle').setAttribute('aria-expanded', String(!isOpen));
    });
    document.getElementById('avatarToggle').addEventListener('click', () => {
        const dropdown = document.getElementById('avatarDropdown');
        const isOpen = dropdown.style.display !== 'none';
        dropdown.style.display = isOpen ? 'none' : 'flex';
        document.getElementById('avatarToggle').setAttribute('aria-expanded', String(!isOpen));
    });
    document.getElementById('portalLogoutBtnMobile').addEventListener('click', handleLogout);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-nav-menu-wrap')) document.getElementById('navMenuDropdown').style.display = 'none';
        if (!e.target.closest('.header-avatar-wrap')) document.getElementById('avatarDropdown').style.display = 'none';
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

    document.querySelectorAll('.partner-resource-link[data-resource]').forEach(btn => {
        btn.addEventListener('click', () => openResourceViewer(btn.dataset.resource));
    });
    document.getElementById('resourceViewerClose').addEventListener('click', () => {
        document.getElementById('resourceViewerModal').style.display = 'none';
    });

    checkSession();
});

async function openResourceViewer(resource) {
    const modal = document.getElementById('resourceViewerModal');
    const title = document.getElementById('resourceViewerTitle');
    const body = document.getElementById('resourceViewerBody');
    const downloadBtn = document.getElementById('resourceViewerDownloadBtn');

    if (resource === 'messages') {
        title.textContent = 'Suggested Messages';
        body.innerHTML = '<p style="color:var(--text-secondary);">Loading…</p>';
        downloadBtn.href = 'suggested-messages.txt';
        modal.style.display = 'flex';

        const res = await fetch('suggested-messages.txt');
        const text = await res.text();
        body.innerHTML = renderMessagesText(text);
} else if (resource === 'logo') {
        title.textContent = 'Veriyo Logo';
        body.innerHTML = '<img src="logo.png" alt="Veriyo logo" style="max-width:100%; display:block; margin:0 auto; border-radius:8px; background:var(--surface-color);" />';
        downloadBtn.href = 'logo.png';
        modal.style.display = 'flex';
    } else if (resource === 'posters') {
        title.textContent = 'Marketing Posters';
        downloadBtn.style.display = 'none';
        const posters = [
            { name: 'Veriyo — Motorist Poster', src: 'posters/veriyo.png' },
            { name: 'Veriyo — Junior Poster', src: 'posters/veriyo-junior.png' },
            { name: 'Veriyo — Senior Poster', src: 'posters/veriyo-senior.png' }
        ];
        body.innerHTML = posters.map(p => `
            <div style="margin-bottom:1.5rem; padding-bottom:1.5rem; border-bottom:1px solid var(--border-color);">
                <img src="${p.src}" alt="${p.name}" style="max-width:100%; border-radius:8px; display:block; margin-bottom:0.75rem;" />
                <p style="color:var(--text-primary); font-weight:600; margin-bottom:0.5rem;">${p.name}</p>
                <a href="${p.src}" download class="btn btn-primary" style="display:block; text-align:center;">Download PNG</a>
            </div>`).join('');
        modal.style.display = 'flex';
    }
}
function renderMessagesText(text) {
    return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<div style="height:0.75rem;"></div>';

        const isSectionHeading = /^[A-Z0-9 ,'-]+$/.test(trimmed) && /[A-Z]/.test(trimmed);
        const isMessageTitle = /^(Message|Workshop Message) \d+/.test(trimmed);

        if (isSectionHeading) {
            return `<p style="color:var(--primary-accent); font-weight:700; font-size:1.05rem; margin-top:1.5rem; margin-bottom:0.5rem;">${escapeHTML(trimmed)}</p>`;
        }
        if (isMessageTitle) {
            return `<p style="color:var(--primary-accent); font-weight:600; margin-top:1.25rem; margin-bottom:0.25rem;">${escapeHTML(trimmed)}</p>`;
        }
        return `<p style="color:var(--text-secondary); line-height:1.8; margin-bottom:0.5rem;">${escapeHTML(trimmed)}</p>`;
    }).join('');
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
        // Partners can't publish — this goes to the admin's Pending queue,
        // same as any workshop-submitted listing.
        status: 'Pending',
        source: 'Partner Added'
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
    alert('Listing added and sent for administrator approval.');
}


async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentSession = session;
        await loadPartnerRecord(session.user.id, session.user.email);
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
    currentSession = data.session;
    await loadPartnerRecord(data.user.id, data.user.email);
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentPartner = null;
    currentSession = null;
    document.getElementById('loginView').style.display = '';
    document.getElementById('notApprovedView').style.display = 'none';
    document.getElementById('trialView').style.display = 'none';
    document.getElementById('portalView').style.display = 'none';
    document.getElementById('loginForm').reset();
}

async function loadPartnerRecord(userId, userEmail) {
    const { data, error } = await supabaseClient
        .from('partners')
        .select('*')
        .eq('user_id', userId)
        .single();

if (error || !data) {
        // Preview mode: lets you look through the portal on a real,
        // signed-in account before a partner application actually exists
        // for it — nothing here is written to the partners table, and
        // every real statistic legitimately shows empty since there's no
        // genuine partner_id behind it.
        currentPartner = { id: null, partner_code: 'PREVIEW', status: 'Preview', full_name: 'Preview' };
        document.getElementById('previewModeBanner').style.display = 'block';
        showPortal();
        return;
    }

    currentPartner = data;

    if (data.status === 'Pending') {
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('notApprovedView').style.display = '';
        return;
    }

    if (data.status === 'Trial') {
        showTrialView();
        return;
    }

    if (data.status === 'Left' || data.status === 'Inactive') {
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('notApprovedView').style.display = '';
        document.querySelector('#notApprovedView h1').textContent = 'Account Inactive';
        document.querySelector('#notApprovedView p').textContent = 'Your partner account is currently inactive. Please contact the administrator.';
        return;
    }

    showPortal();
}

function showTrialView() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('notApprovedView').style.display = 'none';
    document.getElementById('portalView').style.display = 'none';
    document.getElementById('trialView').style.display = '';

    const now = new Date();
    const trialEnd = new Date(currentPartner.trial_ends_at);
    const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    document.getElementById('trialDaysRemaining').textContent = Math.max(0, daysRemaining);

    if (daysRemaining <= 0) {
        document.getElementById('trialActions').style.display = '';
    } else {
        document.getElementById('trialActions').style.display = 'none';
    }
}

async function handleContinueTrial() {
    const { error } = await supabaseClient
        .from('partners')
        .update({
            status: 'Active',
            trial_completed_at: new Date().toISOString()
        })
        .eq('id', currentPartner.id);

    if (error) {
        alert('Failed to update status. Please try again.');
        return;
    }

    currentPartner.status = 'Active';
    showPortal();
}

async function handleLeaveProgramme() {
    if (!confirm('Are you sure you want to leave the programme? This will disable your referral tracking.')) return;

    const { error } = await supabaseClient
        .from('partners')
        .update({ status: 'Left' })
        .eq('id', currentPartner.id);

    if (error) {
        alert('Failed to update status. Please try again.');
        return;
    }

    document.getElementById('trialView').style.display = 'none';
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('notApprovedView').style.display = '';
    document.querySelector('#notApprovedView h1').textContent = 'Goodbye';
    document.querySelector('#notApprovedView p').textContent = 'Thank you for trying Veriyo. Your partner account has been deactivated.';
}

function showPortal() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('notApprovedView').style.display = 'none';
    document.getElementById('trialView').style.display = 'none';
    document.getElementById('portalView').style.display = '';

document.getElementById('partnerCodeDisplay').textContent = currentPartner.partner_code;
    document.getElementById('partnerStatusBadge').textContent = currentPartner.status;

    const displayName = currentPartner.full_name || currentPartner.partner_code || 'Partner';
    const initials = displayName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('avatarToggle').textContent = initials || 'P';
    document.getElementById('avatarDropdownName').textContent = displayName;
    document.getElementById('avatarDropdownStatus').textContent = currentPartner.status;

const referralLink = 'https://veriyo.co.za/?ref=' + currentPartner.partner_code;
    document.getElementById('referralLinkInput').value = referralLink;

    showTab('tasks');
    loadTasks();
    loadDashboardStats();
    loadAnnouncements();
    loadSupportHistory();
    updateLastActive();
}

async function updateLastActive() {
    await supabaseClient
        .from('partners')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', currentPartner.id);
}

function showTab(tabName) {
    document.querySelectorAll('.partner-tab-btn').forEach(btn => {
        btn.classList.toggle('partner-tab-btn--active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.partner-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    const target = document.getElementById('panel-' + tabName);
    if (target) target.style.display = '';
    if (tabName === 'chat') initPartnerChatTab();
}
async function loadTasks() {
    const { data: tasks, error } = await supabaseClient
        .from('partner_tasks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error || !tasks) {
        document.getElementById('tasksContainer').innerHTML = '<p class="partner-no-data">Failed to load tasks.</p>';
        return;
    }

    allTasks = tasks;

    const today = new Date().toISOString().split('T')[0];

    const { data: completions } = await supabaseClient
        .from('partner_task_completions')
        .select('task_id, completed_at')
        .eq('partner_id', currentPartner.id)
        .eq('completion_date', today);

    completedTaskIds = new Set();
    if (completions) {
        completions.forEach(c => completedTaskIds.add(c.task_id));
    }

    renderTasks();

    const { data: report } = await supabaseClient
        .from('partner_activity_reports')
        .select('id')
        .eq('partner_id', currentPartner.id)
        .eq('report_date', today)
        .single();

    todayReportSubmitted = !!report;

    checkAllTasksComplete();
}

function renderTasks() {
    const container = document.getElementById('tasksContainer');
    const completedCount = completedTaskIds.size;
    const totalCount = allTasks.length;

    document.getElementById('tasksCompletedCount').textContent =
        completedCount + ' of ' + totalCount + ' completed';

    if (allTasks.length === 0) {
        container.innerHTML = '<p class="partner-no-data">No tasks available today.</p>';
        return;
    }

    container.innerHTML = allTasks.map((task, index) => {
        const isCompleted = completedTaskIds.has(task.id);
        const number = String(index + 1).padStart(2, '0');
        return `
            <div class="partner-task-card ${isCompleted ? 'partner-task-card--completed' : ''}">
                <div class="partner-task-header">
                    <div class="partner-task-header-left">
                        <span class="partner-task-number">${number}</span>
                        <h3 class="partner-task-title">${escapeHTML(task.title)}</h3>
                    </div>
                    <span class="partner-task-chevron">&#9662;</span>
                </div>
                <div class="partner-task-body">
                    <p class="partner-task-description">${escapeHTML(task.description)}</p>
                    <div class="partner-task-why">
                        <strong>Why it matters:</strong> ${escapeHTML(task.why_matters)}
                    </div>
                    <div class="partner-task-outcome">
                        <strong>Expected outcome:</strong> ${escapeHTML(task.expected_outcome)}
                    </div>
                    <button class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'} partner-task-btn"
                        data-task-id="${task.id}"
                        ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? '&#10003; Completed' : 'Mark as Completed'}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.partner-task-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.partner-task-card').classList.toggle('partner-task-card--collapsed');
        });
    });

    container.querySelectorAll('.partner-task-btn').forEach(btn => {
        if (!btn.disabled) {
            btn.addEventListener('click', () => handleTaskComplete(parseInt(btn.dataset.taskId, 10)));
        }
    });
}

async function handleTaskComplete(taskId) {
    const { error } = await supabaseClient
        .from('partner_task_completions')
        .insert({
            partner_id: currentPartner.id,
            task_id: taskId,
            completed_at: new Date().toISOString(),
            completion_date: new Date().toISOString().split('T')[0]
        });

    if (error) {
        if (error.code === '23505') {
            completedTaskIds.add(taskId);
            renderTasks();
            checkAllTasksComplete();
            return;
        }
        alert('Failed to mark task as complete. Please try again.');
        return;
    }

    completedTaskIds.add(taskId);
    renderTasks();
    checkAllTasksComplete();
}

function checkAllTasksComplete() {
    const allComplete = allTasks.length > 0 && completedTaskIds.size >= allTasks.length;
    const reportSection = document.getElementById('activityReportSection');

    if (allComplete && !todayReportSubmitted) {
        reportSection.style.display = '';
    } else if (allComplete && todayReportSubmitted) {
        reportSection.style.display = '';
        document.getElementById('activityReportForm').style.display = 'none';
        document.getElementById('reportSuccess').style.display = '';
    } else {
        reportSection.style.display = 'none';
    }
}

async function handleActivityReport(event) {
    event.preventDefault();

    const reportData = {
        partner_id: currentPartner.id,
        report_date: new Date().toISOString().split('T')[0],
        groups_reached: parseInt(document.getElementById('reportGroupsReached').value, 10) || 0,
        estimated_people_reached: parseInt(document.getElementById('reportPeopleReached').value, 10) || 0,
        conversations_started: parseInt(document.getElementById('reportConversations').value, 10) || 0,
        questions_received: parseInt(document.getElementById('reportQuestions').value, 10) || 0,
        interesting_feedback: document.getElementById('reportFeedback').value.trim() || null,
        problems_encountered: document.getElementById('reportProblems').value.trim() || null,
        motorist_ideas: document.getElementById('reportIdeas').value.trim() || null,
        additional_notes: document.getElementById('reportNotes').value.trim() || null
    };

    const { error } = await supabaseClient
        .from('partner_activity_reports')
        .insert(reportData);

    if (error) {
        if (error.code === '23505') {
            alert('You have already submitted a report today.');
            return;
        }
        alert('Failed to submit report: ' + error.message);
        return;
    }

    todayReportSubmitted = true;
    document.getElementById('activityReportForm').style.display = 'none';
    document.getElementById('reportSuccess').style.display = '';

    await supabaseClient
        .from('partners')
        .update({ tasks_completed_today: completedTaskIds.size })
        .eq('id', currentPartner.id);
}

async function loadDashboardStats() {
    const partnerId = currentPartner.id;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

const [todayRes, weekRes, monthRes, allRes] = await Promise.all([
        supabaseClient.from('partner_visitors').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId).gte('last_visit_at', todayStart),
        supabaseClient.from('partner_visitors').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId).gte('last_visit_at', weekAgo),
        supabaseClient.from('partner_visitors').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId).gte('last_visit_at', monthAgo),
        supabaseClient.from('partner_visitors').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId)
    ]);
    const todayVisitors = todayRes.count || 0;
    const weekVisitors = weekRes.count || 0;
    const monthVisitors = monthRes.count || 0;
    const totalVisitors = allRes.count || 0;

    document.getElementById('statTodayVisitors').textContent = todayVisitors.toLocaleString('en-ZA');
    document.getElementById('statWeekVisitors').textContent = weekVisitors.toLocaleString('en-ZA');
    document.getElementById('statMonthVisitors').textContent = monthVisitors.toLocaleString('en-ZA');
    document.getElementById('statTotalVisitors').textContent = totalVisitors.toLocaleString('en-ZA');

    document.getElementById('statMotoristReports').textContent = (currentPartner.total_motorist_submissions || 0).toLocaleString('en-ZA');
    document.getElementById('statWorkshopSignups').textContent = (currentPartner.total_workshop_signups || 0).toLocaleString('en-ZA');
    document.getElementById('statApprovedWorkshops').textContent = (currentPartner.total_approved_workshops || 0).toLocaleString('en-ZA');

    const conversionRate = totalVisitors > 0
        ? ((currentPartner.total_conversions || 0) / totalVisitors * 100).toFixed(1)
        : '0';
    document.getElementById('statConversionRate').textContent = conversionRate + '%';

    const earnings = parseFloat(currentPartner.estimated_earnings || 0);
    document.getElementById('statEarnings').textContent =
        new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(earnings);

document.getElementById('refLinkClicks').textContent = totalVisitors.toLocaleString('en-ZA');
    document.getElementById('refLinkConversions').textContent = (currentPartner.total_conversions || 0).toLocaleString('en-ZA');
}

async function copyTextToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
    }
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
}

async function loadRecruitedWorkshops() {
    const listEl = document.getElementById('recruitedWorkshopsList');
    listEl.innerHTML = '<div class="partner-loading">Loading…</div>';

    const { data: recruited, error } = await supabaseClient
        .from('Workshopprofiles')
        .select('workshop_name, plan, status')
        .eq('referral_source', currentPartner.partner_code)
        .order('created_at', { ascending: false });

if (error || !recruited || recruited.length === 0) {
        const referralLink = 'https://veriyo.co.za/?ref=' + currentPartner.partner_code;
        listEl.innerHTML =
            '<div class="chat-conv-empty">' +
            '<p style="margin-bottom:1rem;">You have no recruited workshops yet. Get workshops to sign up using your referral link to have recruited workshops.</p>' +
            '<button type="button" class="btn btn-primary" id="copyReferralLinkEmptyBtn">Copy Referral Link</button>' +
            '</div>';
        document.getElementById('copyReferralLinkEmptyBtn').addEventListener('click', function () {
            copyTextToClipboard(referralLink, this);
        });
        return;
    }
    listEl.innerHTML = recruited.map(w => {
        const planLabel = w.plan
            ? '<span class="badge badge-success">' + escapeHtmlP(w.plan) + '</span>'
            : '<span class="badge badge-neutral">No plan chosen yet</span>';
        return '<div class="chat-conv-item" style="cursor:default;">' +
            '<div class="chat-conv-info">' +
            '  <div class="chat-conv-id">' + escapeHtmlP(w.workshop_name || 'Unnamed workshop') + '</div>' +
            '  <div class="chat-conv-preview">' + planLabel + '</div>' +
            '</div></div>';
    }).join('');
}

function escapeHtmlP(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

async function loadAnnouncements() {
    const { data: announcements, error } = await supabaseClient
        .from('partner_announcements')
        .select('id, title, message, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !announcements || announcements.length === 0) {
        document.getElementById('announcementsList').innerHTML =
            '<p class="partner-no-data">No announcements yet.</p>';
        return;
    }

    const { data: reads } = await supabaseClient
        .from('partner_announcement_reads')
        .select('announcement_id')
        .eq('partner_id', currentPartner.id);

    const readIds = new Set();
    if (reads) reads.forEach(r => readIds.add(r.announcement_id));

    const container = document.getElementById('announcementsList');
    container.innerHTML = announcements.map(a => {
        const isUnread = !readIds.has(a.id);
        return `
            <div class="partner-announcement-item ${isUnread ? 'partner-announcement--unread' : ''}">
                ${isUnread ? '<span class="partner-unread-dot"></span>' : ''}
                <h4>${escapeHTML(a.title)}</h4>
                <p>${escapeHTML(a.message)}</p>
                <span class="partner-announcement-date">${formatDate(a.created_at)}</span>
            </div>
        `;
    }).join('');

    const unreadIds = announcements.filter(a => !readIds.has(a.id)).map(a => a.id);
    if (unreadIds.length > 0) {
        const readInserts = unreadIds.map(id => ({
            partner_id: currentPartner.id,
            announcement_id: id
        }));
        await supabaseClient.from('partner_announcement_reads').insert(readInserts);
    }
}

async function copyReferralLink() {
    const input = document.getElementById('referralLinkInput');
    const btn = document.getElementById('copyReferralBtn');

    try {
        await navigator.clipboard.writeText(input.value);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    } catch (e) {
        input.select();
        document.execCommand('copy');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }
}

async function handleSupportRequest(event) {
    event.preventDefault();

    const subject = document.getElementById('supportSubject').value.trim();
    const message = document.getElementById('supportMessage').value.trim();

    if (!subject || !message) return;

    const { error } = await supabaseClient
        .from('partner_support_requests')
        .insert({
            partner_id: currentPartner.id,
            subject: subject,
            message: message
        });

   if (error) {
        alert('Failed to submit request: ' + error.message);
        return;
    }

    // Drop a titled marker into the shared chat thread with admin — this is
    // where the actual conversation about it happens from here on, not a
    // one-shot response field.
    await supabaseClient.from('chats').insert({
        partner_id: currentSession.user.id,
        sender: 'partner',
        message_text: '📌 Support Request: ' + subject + '\n\n' + message
    });

    document.getElementById('supportForm').reset();
    document.getElementById('supportSuccess').style.display = '';
    setTimeout(() => { document.getElementById('supportSuccess').style.display = 'none'; }, 3000);

    loadSupportHistory();
}
async function loadSupportHistory() {
    const { data: requests, error } = await supabaseClient
        .from('partner_support_requests')
        .select('id, subject, message, status, admin_response, created_at, responded_at')
        .eq('partner_id', currentPartner.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error || !requests || requests.length === 0) {
        document.getElementById('supportHistoryList').innerHTML =
            '<p class="partner-no-data">No support requests yet.</p>';
        return;
    }

    const container = document.getElementById('supportHistoryList');
    container.innerHTML = requests.map(r => {
        const statusClass = r.status === 'Resolved' || r.status === 'Closed' ? 'partner-support-status--resolved' :
            r.status === 'In Progress' ? 'partner-support-status--progress' : 'partner-support-status--open';
        let responseHtml = '';
        if (r.admin_response) {
            responseHtml = `
                <div class="partner-support-response">
                    <strong>Admin response:</strong> ${escapeHTML(r.admin_response)}
                </div>
            `;
        }
        return `
            <div class="partner-support-item">
                <div class="partner-support-header">
                    <h4>${escapeHTML(r.subject)}</h4>
                    <span class="partner-support-status ${statusClass}">${escapeHTML(r.status)}</span>
                </div>
                <p class="partner-support-message">${escapeHTML(r.message)}</p>
                ${responseHtml}
                <span class="partner-support-date">${formatDate(r.created_at)}</span>
            </div>
        `;
    }).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHTML(unsafe) {
    return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
