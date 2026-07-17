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
            const icon = a.icon
                ? '<svg width="18" height="18" aria-hidden="true"><use href="icons.svg#' + a.icon + '"></use></svg>'
                : '';
             return '<a href="' + a.href + '" class="btn ' + (a.primary ? 'btn-primary' : 'btn-secondary') + '">' + icon + escapeHtml(a.label) + '</a>';
        }).join('');
   
    }
    async function loadDashboard(session) {
        const nameEl = document.getElementById('whWorkshopName');
        const statusCard = document.getElementById('whStatusCard');
        const actionsEl = document.getElementById('whQuickActions');


const { data: rows } = await _sb
            .from('Workshopprofiles')
            .select('id, workshop_name, suburb, city, province, status, plan, rmi_registered, written_quote, guarantee_work, guarantee_period, price_oil_change, price_minor_service, price_major_service, price_alignment, price_brake_pads, price_diagnostic, custom_service_name_1, custom_service_name_2')
            .eq('user_id', session.user.id)
            .limit(1);

        const myWorkshop = (rows && rows.length > 0) ? rows[0] : null;

        nameEl.textContent = myWorkshop ? myWorkshop.workshop_name : (session.user.user_metadata && session.user.user_metadata.display_name) || 'there';

        if (!myWorkshop) {
            statusCard.innerHTML =
                '<p style="color:var(--text-primary); margin-bottom:0.5rem;">You have not created a workshop listing yet.</p>' +
                '<p style="color:var(--text-secondary); font-size:0.9rem;">Create one to start building your presence on Veriyo.</p>';
renderQuickActions(actionsEl, [
                { href: 'list-workshop.html', label: 'Create My Listing', primary: true, icon: 'icon-addlisting' }
            ]);

            return;
        }

const location = [myWorkshop.suburb, myWorkshop.city, myWorkshop.province].filter(Boolean).join(', ');
        const editHref = 'list-workshop.html?edit=' + encodeURIComponent(myWorkshop.id);

        // Text callout in place of an image — shows their actual plan tier
        // rather than a picture, since no images are used here.
statusCard.innerHTML =
            '<div style="background:var(--bg-color); border:1px solid var(--border-color); border-radius:var(--radius); padding:0.9rem 1.1rem; text-align:center; min-width:120px;">' +
'  <p style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.25rem;">Your Plan</p>' +
            '  <p style="font-size:1.05rem; font-weight:700; color:var(--primary-accent);">' + escapeHtml(myWorkshop.plan || 'Not set') + '</p>' +
            '</div>' +
            '<div style="flex:1; min-width:180px;">' +
            '  <p style="font-size:1.05rem; font-weight:600; color:var(--text-primary); margin-bottom:0.25rem;">' + escapeHtml(myWorkshop.workshop_name) + '</p>' +
            '  <p style="font-size:0.92rem; color:var(--text-secondary);">' + escapeHtml(location) + '</p>' +
            '</div>' +
            '<div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.6rem;">' +
            '  <span class="badge ' + statusBadgeClass(myWorkshop.status) + '">' + escapeHtml(myWorkshop.status || 'Pending') + '</span>' +
            '  <a href="my-listing.html" class="btn btn-secondary" style="font-size:0.85rem;">View My Listing</a>' +
            '</div>';

renderQuickActions(actionsEl, [
            { href: 'my-listing.html', label: 'View My Listing', primary: true, icon: 'icon-listing' },
            { href: 'chat.html?mode=workshop', label: 'Open Chat', primary: false, icon: 'icon-chat' },
{ href: editHref, label: 'Update Details', primary: false, icon: 'icon-pencil' }
]);

        // Services You Offer — real services only, capped at 5, no icons invented.
        const allServices = [
            myWorkshop.price_oil_change != null ? 'Oil Change' : null,
            myWorkshop.price_minor_service != null ? 'Minor Service' : null,
            myWorkshop.price_major_service != null ? 'Major Service' : null,
            myWorkshop.price_alignment != null ? 'Wheel Alignment' : null,
            myWorkshop.price_brake_pads != null ? 'Brake Pads' : null,
            myWorkshop.price_diagnostic != null ? 'Diagnostic' : null,
            myWorkshop.custom_service_name_1 || null,
            myWorkshop.custom_service_name_2 || null
        ].filter(Boolean).slice(0, 5);

// Fixed value-proposition checklist for this card — not sourced
        // from workshop record fields.
        const highlights = ['Prices Visible to Motorists', 'Fast Response to Enquiries', 'Trusted by Local Customers'];
        const detailColumns = document.getElementById('whDetailColumns');
        const servicesListEl = document.getElementById('whServicesList');
        const highlightsListEl = document.getElementById('whHighlightsList');
        document.getElementById('whEditListingBtn').href = editHref;

        if (allServices.length > 0 || highlights.length > 0) {
            detailColumns.style.display = 'grid';
            servicesListEl.innerHTML = allServices.length
                ? allServices.map(function (s) {
                    return '<li style="padding:0.5rem 0; border-bottom:1px solid var(--border-color); font-size:0.9rem; color:var(--text-primary);">' + escapeHtml(s) + '</li>';
                }).join('')
                : '<li style="color:var(--text-secondary); font-size:0.9rem;">No services added yet.</li>';
highlightsListEl.innerHTML = highlights.map(function (h) {
                return '<li style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0; font-size:0.9rem; color:var(--text-primary);">' +
                    '<svg width="18" height="18" style="color:var(--success-color); flex-shrink:0;" aria-hidden="true"><use href="icons.svg#icon-check-circle"></use></svg>' +
                    escapeHtml(h) + '</li>';
            }).join('');
        }


// Unread chat count (spec 3.4 "Unread Chat Count").
        // Cutoff is the later of last sign-in and the last time this workshop
        // opened its Messages, so the badge clears once messages are read
        // instead of persisting until the next login.
        const lastRead = localStorage.getItem('veriyo_chat_read_' + myWorkshop.id);
        const lastLogin = session.user.last_sign_in_at || new Date(0).toISOString();
        const since = (lastRead && lastRead > lastLogin) ? lastRead : lastLogin;
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
