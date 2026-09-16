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
        // Only the icons that were replaced with the new artwork (Chat, Update
        // Details' pencil) get the larger size here; icon-addlisting and
        // icon-listing, drawn by the same function, are left at 18px.
        const largerIcons = ['icon-chat', 'icon-pencil'];
        container.innerHTML = actions.map(function (a) {
            const iconSize = a.icon && largerIcons.indexOf(a.icon) !== -1 ? 24 : 18;
            const icon = a.icon
                ? '<svg width="' + iconSize + '" height="' + iconSize + '" aria-hidden="true"><use href="icons.svg#' + a.icon + '"></use></svg>'
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
            .select('id, workshop_name, suburb, city, province, status, plan, rmi_registered, written_quote, guarantee_work, guarantee_period, price_oil_change, price_minor_service, price_major_service, price_alignment, price_brake_pads, price_diagnostic, custom_service_name_1, custom_service_name_2, signboard_photo_url, interior_photo_url')
            .eq('user_id', session.user.id)
            .limit(1);

        const myWorkshop = (rows && rows.length > 0) ? rows[0] : null;

        nameEl.textContent = myWorkshop ? myWorkshop.workshop_name : (session.user.user_metadata && session.user.user_metadata.display_name) || 'there';

        if (!myWorkshop) {
            statusCard.innerHTML =
                '<p style="color:var(--text-primary); margin-bottom:0.5rem;">Motorists searching for a workshop right now can\'t see you yet.</p>' +
                '<p style="color:var(--text-secondary); font-size:0.9rem;">Create your listing to start showing up in their search.</p>';
renderQuickActions(actionsEl, [
                { href: 'list-workshop.html', label: 'Create My Listing', primary: true, icon: 'icon-addlisting' }
            ]);

            return;
        }

        const location = [myWorkshop.suburb, myWorkshop.city, myWorkshop.province].filter(Boolean).join(', ');
        const editHref = 'list-workshop.html?edit=' + encodeURIComponent(myWorkshop.id);

        // Shows the workshop's own signboard/interior photo — this data was
        // already being fetched nowhere before, and the .image-placeholder
        // classes below already existed in styles.css for exactly this, just
        // never wired up. Falls back to a plain icon if neither photo is set.
        const photoUrl = myWorkshop.signboard_photo_url || myWorkshop.interior_photo_url;
        const photoMarkup = photoUrl
            ? '<img class="image-placeholder-photo" src="' + escapeHtml(photoUrl) + '" alt="' + escapeHtml(myWorkshop.workshop_name) + '">'
            : '<div class="image-placeholder-icon"><svg width="64" height="64" aria-hidden="true"><use href="icons.svg#icon-building"></use></svg></div>';

        statusCard.innerHTML =
            '<div class="image-placeholder image-placeholder--small">' + photoMarkup + '</div>' +
            '<div class="listing-status-info">' +
            '  <h3>' + escapeHtml(myWorkshop.workshop_name) + '</h3>' +
            '  <p>' + escapeHtml(location) + '</p>' +
            '  <p style="margin-top:0.4rem;"><span class="badge badge-neutral" style="font-size:0.72rem;">' + escapeHtml(myWorkshop.plan || 'Plan not set') + '</span></p>' +
            '</div>' +
            '<div class="listing-status-actions">' +
            '  <span class="badge ' + statusBadgeClass(myWorkshop.status) + '">' + escapeHtml(myWorkshop.status || 'Pending') + '</span>' +
            '  <a href="my-listing.html" class="btn btn-secondary" style="font-size:0.85rem;">View My Listing</a>' +
            '</div>';

        const isFreePlan = !myWorkshop.plan || myWorkshop.plan === 'Visible';

renderQuickActions(actionsEl, [
            { href: 'my-listing.html', label: 'View My Listing', primary: true, icon: 'icon-listing' },
            { href: 'chat.html?mode=workshop', label: isFreePlan ? 'Messages (Locked)' : 'Open Chat', primary: false, icon: 'icon-chat' },
{ href: editHref, label: 'Update Details', primary: false, icon: 'icon-pencil' }
].concat(isFreePlan ? [{ href: 'mailto:privacy@veriyo.co.za?subject=Upgrade%20my%20Veriyo%20plan', label: 'Upgrade My Plan', primary: true, icon: null }] : []));
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

// Real trust signals only — sourced from fields the workshop actually
        // filled in, plus a genuine average rating computed the same way the
        // public workshop profile page computes it (Submissions table,
        // Approved status, matched by workshop name). Previously this was a
        // fixed, unverifiable list ("Fast Response to Enquiries", "Trusted
        // by Local Customers") that wasn't tied to anything real.
        const { data: ratingSubs } = await _sb
            .from('Submissions')
            .select('rating')
            .eq('status', 'Approved')
            .ilike('workshop_name', myWorkshop.workshop_name);
        const ratedSubs = (ratingSubs || []).filter(function (s) { return s.rating && s.rating > 0; });

        const highlights = [];
        if (ratedSubs.length > 0) {
            const avg = ratedSubs.reduce(function (sum, s) { return sum + s.rating; }, 0) / ratedSubs.length;
            highlights.push('★ ' + avg.toFixed(1) + ' Average Rating (' + ratedSubs.length + (ratedSubs.length === 1 ? ' review' : ' reviews') + ')');
        }
        if (myWorkshop.rmi_registered === 'Yes') highlights.push('RMI Registered Workshop');
        if (myWorkshop.written_quote === 'Yes') highlights.push('Written Quotes Provided');
        if (myWorkshop.guarantee_work === 'Yes') {
            highlights.push(myWorkshop.guarantee_period ? 'Guarantee on Work: ' + myWorkshop.guarantee_period : 'Guarantee on All Work');
        }
        highlights.push('Prices Visible to Motorists on Veriyo');
        // Nudge, not filler — shown only once, when there's nothing else to
        // show yet, and it points at something real they can go do.
        if (highlights.length === 1) {
            highlights.push('Add RMI registration, a written quote, or a work guarantee on your listing to stand out more');
        }
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


// Unread chat count (spec 3.4 "Unread Chat Count"). Free-tier workshops
        // never get a "last read" marker set — chat.js locks their inbox and
        // returns before that code runs — so for them this counts every
        // motorist message ever received, not just the delta since last read.
        const lastRead = localStorage.getItem('veriyo_chat_read_' + myWorkshop.id);
        const lastLogin = session.user.last_sign_in_at || new Date(0).toISOString();
        const since = (lastRead && lastRead > lastLogin) ? lastRead : lastLogin;
        let unreadQuery = _sb
            .from('chats')
            .select('id')
            .eq('workshop_id', myWorkshop.id)
            .eq('sender', 'motorist');
        if (!isFreePlan) unreadQuery = unreadQuery.gt('created_at', since);
        const { data: unread } = await unreadQuery;

        if (unread && unread.length > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = 'badge ' + (isFreePlan ? 'badge-danger' : 'badge-neutral');
            countBadge.style.marginLeft = '0.5rem';
            countBadge.textContent = isFreePlan
                ? unread.length + ' waiting — upgrade to read'
                : unread.length + ' unread';
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
