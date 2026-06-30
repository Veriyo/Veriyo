/**
 * Veriyo | Auth Navbar Injection
 * Checks Supabase session and injects avatar + bell into navbar on every page.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

    const _supabaseAuthNav = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    function getInitials(session) {
        const displayName = session.user.user_metadata && session.user.user_metadata.display_name;
        if (displayName && displayName.trim().length > 0) {
            return displayName.trim()[0].toUpperCase();
        }
        return session.user.email ? session.user.email[0].toUpperCase() : '?';
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.nav-avatar-dropdown').forEach(function (el) {
            el.style.display = 'none';
        });
    }

    async function checkUnreadBell(workshopId, lastLoginAt, bellEl) {
        if (!workshopId || !bellEl) return;
        const since = lastLoginAt || new Date(0).toISOString();
        const { data } = await _supabaseAuthNav
            .from('chats')
            .select('id')
            .eq('workshop_id', workshopId)
            .eq('sender', 'motorist')
            .gt('created_at', since)
            .limit(1);
        if (data && data.length > 0) {
            const dot = document.createElement('span');
            dot.className = 'nav-bell-dot';
            bellEl.style.position = 'relative';
            bellEl.appendChild(dot);
        }
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const { data: { session } } = await _supabaseAuthNav.auth.getSession();
        if (!session) return;

        const navLinks = document.getElementById('navLinksContainer');
        if (!navLinks) return;

        const initials = getInitials(session);
        const userEmail = session.user.email;

        const li = document.createElement('li');
        li.className = 'nav-auth-item';
        li.innerHTML = [
            '<span id="navBell" class="nav-bell" title="Notifications">&#128276;</span>',
            '<div class="nav-avatar-wrap">',
            '  <div id="navAvatar" class="nav-avatar" title="Account">' + initials + '</div>',
            '  <div class="nav-avatar-dropdown" id="navAvatarDropdown" style="display:none;">',
            '    <div class="nav-dropdown-email">' + escapeHtml(userEmail) + '</div>',
            '    <a href="workshop-home.html" class="nav-dropdown-item">My Profile</a>',
            '    <button class="nav-dropdown-item nav-dropdown-signout" id="navSignOutBtn">Sign Out</button>',
            '  </div>',
            '</div>'
        ].join('');

        navLinks.appendChild(li);

        const avatarEl = document.getElementById('navAvatar');
        const dropdownEl = document.getElementById('navAvatarDropdown');
        const bellEl = document.getElementById('navBell');

        avatarEl.addEventListener('click', function (e) {
            e.stopPropagation();
            const isVisible = dropdownEl.style.display !== 'none';
            closeAllDropdowns();
            dropdownEl.style.display = isVisible ? 'none' : 'block';
        });

        document.addEventListener('click', function () {
            closeAllDropdowns();
        });

        document.getElementById('navSignOutBtn').addEventListener('click', async function () {
            await _supabaseAuthNav.auth.signOut();
            window.location.reload();
        });

        // Check if this user is a workshop manager and show unread notification
        const { data: workshopData } = await _supabaseAuthNav
            .from('Workshopprofiles')
            .select('id')
            .eq('email_address', userEmail)
            .limit(1);

        if (workshopData && workshopData.length > 0) {
            const wId = workshopData[0].id;
            const lastLogin = session.user.last_sign_in_at;
            await checkUnreadBell(wId, lastLogin, bellEl);
        }
    });

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
})();
