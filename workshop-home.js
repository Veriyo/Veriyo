/**
 * Veriyo | Workshop Home (dashboard)
 * Spec 3.4 — Workshop Welcome Card, Listing Status, Quick Actions,
 * Recent Notifications, Unread Chat Count.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function statusBadgeClass(status) {
        if (!status) return 'badge-neutral';
        const s = status.toLowerCase();
        if (s === 'approved') return 'badge-success';
        if (s === 'rejected') return 'badge-danger';
        return 'badge-neutral';
    }

    function formatTime(ts) {
        if (!ts) return '';
        return new Date(ts).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function renderQuickActions(container, actions) {
        container.innerHTML = actions.map(function (a) {
            return '<a href="' + a.href + '" class="btn ' + (a.primary ? 'btn-primary' : 'btn-secondary') + '" style="font-size:0.9rem;">' + escapeHtml(a.label) + '</a>';
        }).join('');
    }

    async function loadDashboard(session) {
        const nameEl = document.getElementById('whWorkshopName');
        const statusCard = document.getElementById('whStatusCard');
        const actionsEl = document.getElementById('whQuickActions');
        const notifListEl = document.getElementById('whNotifList');
        const notifEmptyEl = document.getElementById('whNotifEmpty');

        const { data: rows } = await _sb
            .from('Workshopprofiles')
            .select('id, workshop_name, suburb, city, province, status')
            .eq('user_id', session.user.id)
            .limit(1);

        const myWorkshop = (rows && rows.length > 0) ? rows[0] : null;

        nameEl.textContent = myWorkshop ? myWorkshop.workshop_name : (session.user.user_metadata && session.user.user_metadata.display_name) || 'there';

        if (!myWorkshop) {
            statusCard.innerHTML =
                '<p style="color:var(--text-primary); margin-bottom:0.5rem;">You have not created a workshop listing yet.</p>' +
                '<p style="color:var(--text-secondary); font-size:0.9rem;">Create one to start building your presence on Veriyo.</p>';
            renderQuickActions(actionsEl, [
                { href: 'list-workshop.html', label: 'Create My Listing', primary: true }
            ]);
            notifListEl.style.display = 'none';
            notifEmptyEl.style.display = 'block';
            return;
        }

        const location = [myWorkshop.suburb, myWorkshop.city, myWorkshop.province].filter(Boolean).join(', ');
        statusCard.innerHTML =
            '<div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">' +
            '  <div>' +
            '    <p style="font-weight:600; color:var(--text-primary); margin-bottom:0.25rem;">' + escapeHtml(myWorkshop.workshop_name) + '</p>' +
            '    <p style="font-size:0.85rem; color:var(--text-secondary);">' + escapeHtml(location) + '</p>' +
            '  </div>' +
            '  <span class="badge ' + statusBadgeClass(myWorkshop.status) + '">' + escapeHtml(myWorkshop.status || 'Pending') + '</span>' +
            '</div>';

        renderQuickActions(actionsEl, [
            { href: 'my-listing.html', label: 'View My Listing', primary: true },
            { href: 'list-workshop.html', label: 'Update Listing', primary: false },
            { href: 'chat.html?mode=workshop', label: 'Open Chat', primary: false }
        ]);

        // Recent notifications (administrator-originated only — spec 8.6).
        const { data: notifs } = await _sb
            .from('notifications')
            .select('*')
            .eq('workshop_id', myWorkshop.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!notifs || notifs.length === 0) {
            notifListEl.style.display = 'none';
            notifEmptyEl.style.display = 'block';
        } else {
            notifEmptyEl.style.display = 'none';
            notifListEl.style.display = 'block';
            notifListEl.innerHTML = notifs.map(function (n) {
                const inner = '<div class="chat-conv-avatar">&#128276;</div>' +
                    '<div class="chat-conv-info">' +
                    '  <div class="chat-conv-id">' + escapeHtml(n.message) + '</div>' +
                    '  <div class="chat-conv-preview">' + escapeHtml(formatTime(n.created_at)) + '</div>' +
                    '</div>';
                return n.link
                    ? '<a href="' + escapeHtml(n.link) + '" class="chat-conv-item">' + inner + '</a>'
                    : '<div class="chat-conv-item" style="cursor:default;">' + inner + '</div>';
            }).join('');
        }

        // Unread chat count (spec 3.4 "Unread Chat Count"). Prefers the real
        // "last viewed workshop chat" marker chat.js sets on every visit to
        // chat.html?mode=workshop — last_sign_in_at only updates on a fresh
        // login, so it never reflected messages actually read this session.
        // Falls back to last_sign_in_at only if chat has never been opened yet.
        const storedLastViewed = localStorage.getItem('veriyo_workshop_chat_last_viewed_' + myWorkshop.id);
        const since = storedLastViewed || session.user.last_sign_in_at || new Date(0).toISOString();
        const { data: unread } = await _sb
            .from('chats')
            .select('id')
            .eq('workshop_id', myWorkshop.id)
            .eq('sender', 'motorist')
            .gt('created_at', since);

        if (unread && unread.length > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = 'badge badge-neutral';
            countBadge.style.marginLeft = '0.5rem';
            countBadge.textContent = unread.length + ' unread';
            const chatAction = actionsEl.querySelector('a[href^="chat.html"]');
            if (chatAction) chatAction.after(countBadge);
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const { data: { session } } = await _sb.auth.getSession();

        document.getElementById('whHomeLoading').style.display = 'none';

        if (!session) {
            document.getElementById('whHomeSignIn').style.display = 'block';
            return;
        }

        document.getElementById('whHomeContent').style.display = 'block';
        await loadDashboard(session);
    });
})();
