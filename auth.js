/**
 * Veriyo | Auth Navbar Injection
 * Checks Supabase session and injects avatar + bell or sign-in link.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';

    const _supabaseAuthNav = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    function getInitials(session) {
        const displayName = session.user.user_metadata &&
            session.user.user_metadata.display_name;
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
        const navbar = document.querySelector('.navbar--top');
        if (!navbar) return;

        if (!session) {
            const li = document.createElement('li');
            li.className = 'nav-auth-item';
            li.style.cssText = 'position:absolute; right:1.5rem; top:50%; transform:translateY(-50%); list-style:none;';
            li.innerHTML = '<a href="auth.html" class="nav-signin-link">Sign In</a>';
            navbar.appendChild(li);
            return;
        }

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
            '    <a href="auth.html" class="nav-dropdown-item">My Profile</a>',
            '    <button class="nav-dropdown-item nav-dropdown-signout"',
            '        id="navSignOutBtn">Sign Out</button>',
            '  </div>',
            '</div>'
        ].join('');

        li.style.cssText = 'position:absolute; right:1.5rem; top:50%; transform:translateY(-50%); display:flex; align-items:center; gap:0.75rem; list-style:none;';
        navbar.appendChild(li);

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

        if (bellEl) {
            bellEl.style.cursor = 'pointer';
            bellEl.addEventListener('click', function (e) {
                e.stopPropagation();
                const existing = document.getElementById('veNotifPanel');
                if (existing) {
                    existing.remove();
                    return;
                }
                const panel = document.createElement('div');
                panel.id = 'veNotifPanel';
                panel.style.cssText = [
                    'position:fixed',
                    'top:60px',
                    'right:0',
                    'width:min(360px,100vw)',
                    'height:calc(100vh - 60px)',
                    'background:var(--surface-color)',
                    'border-left:1px solid var(--border-color)',
                    'z-index:3000',
                    'display:flex',
                    'flex-direction:column',
                    'padding:1.5rem',
                    'gap:1rem',
                    'animation:slideInRight 0.25s ease',
                    'overflow-y:auto'
                ].join(';');
                panel.innerHTML = [
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">',
                    '  <h2 style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">Notifications</h2>',
                    '  <button id="veNotifClose" style="background:none;border:none;color:var(--text-secondary);font-size:1.2rem;cursor:pointer;">&#10005;</button>',
                    '</div>',
                    '<div style="border-bottom:1px solid var(--border-color);margin-bottom:0.5rem;"></div>',
                    '<div style="text-align:center;padding:2rem 1rem;color:var(--text-secondary);">',
                    '  <div style="font-size:2rem;margin-bottom:0.75rem;">&#128172;</div>',
                    '  <p style="font-size:0.9rem;line-height:1.6;margin-bottom:1.25rem;">No messages yet. Start a conversation with a workshop to get replies here.</p>',
                    '  <a href="workshops.html" style="display:inline-block;background:var(--primary-accent);color:#000;padding:0.6rem 1.4rem;border-radius:var(--radius);font-weight:700;font-size:0.88rem;text-decoration:none;">Browse Workshops</a>',
                    '</div>'
                ].join('');
                document.body.appendChild(panel);
                document.getElementById('veNotifClose').addEventListener('click', function () {
                    panel.remove();
                });
                document.addEventListener('click', function closePanel(ev) {
                    if (!panel.contains(ev.target) && ev.target !== bellEl) {
                        panel.remove();
                        document.removeEventListener('click', closePanel);
                    }
                });
            });
        }

        document.getElementById('navSignOutBtn').addEventListener('click',
            async function () {
                await _supabaseAuthNav.auth.signOut();
                window.location.reload();
            }
        );

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
