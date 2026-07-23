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

    // Marks the message icon (not the bell) with a dot when a workshop has
    // an unread motorist message, since unread chat belongs to Messages,
    // and the bell is reserved for administrator notifications.
    async function checkUnreadBell(workshopId, lastLoginAt, iconEl) {
        if (!workshopId || !iconEl) return;
        // Cutoff is the later of last sign-in and the last time this workshop
        // opened its Messages, so the dot clears once messages are read
        // instead of persisting until the next login.
        const lastRead = localStorage.getItem('veriyo_chat_read_' + workshopId);
        const lastLogin = lastLoginAt || new Date(0).toISOString();
        const since = (lastRead && lastRead > lastLogin) ? lastRead : lastLogin;
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
            iconEl.style.position = 'relative';
            iconEl.appendChild(dot);
        }
    }
// Reveals the nav once we've actually decided what belongs in it —
    // called at the very end no matter which path the code below takes,
    // so the nav can never get stuck invisible if something goes wrong.
    function revealNav() {
        const topNavEl = document.querySelector('.nav-links');
        const bottomNavEl = document.querySelector('.bottom-nav-links');
        if (topNavEl) topNavEl.style.visibility = 'visible';
        if (bottomNavEl) bottomNavEl.style.visibility = 'visible';
    }

    document.addEventListener('DOMContentLoaded', async function () {
      try {
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

        // Determine account type once so both the message icon (routing) and
        // the bell (unread-chat dot) can reuse it, instead of each re-deriving it.
        const { data: workshopData } = await _supabaseAuthNav
            .from('Workshopprofiles')
            .select('id')
            .eq('email_address', userEmail)
            .limit(1);
const myWorkshopId = (workshopData && workshopData.length > 0) ? workshopData[0].id : null;

        // A workshop account should only ever see workshop-relevant pages in
        // the nav — never the motorist-only Home/Report pages — and should
        // never see a permanent "List My Workshop" link, since a workshop
        // only ever creates one listing and manages it from My Listing from
        // then on. This rewrites both the top nav and the mobile bottom nav
        // wherever they appear, so every page stays in sync automatically.
        if (myWorkshopId) {
            const topLinks = [
                ['workshop-home.html', 'Home'],
                ['prices.html', 'Prices'],
                ['workshops.html', 'Workshops'],
                ['my-listing.html', 'My Listing']
            ];
            const bottomLinks = [
                ['workshop-home.html', 'Home', 'icon-home'],
                ['prices.html', 'Prices', 'icon-prices'],
                ['workshops.html', 'Workshops', 'icon-workshops'],
                ['my-listing.html', 'My Listing', 'icon-listing']
            ];

// Cloudflare Pages serves this site with the .html extension
            // dropped from the address bar (e.g. "/workshops", not
            // "/workshops.html"), so matching must ignore the extension too.
            function isCurrentPage(fileName) {
                const page = fileName.replace(/\.html$/, '');
                const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
                return path === '/' + page || path.endsWith('/' + page);
            }

            const topNavEl = document.querySelector('.nav-links');
            if (topNavEl) {
                topNavEl.innerHTML = topLinks.map(function (l) {
                    const isActive = isCurrentPage(l[0]);
                    return '<li><a href="' + l[0] + '"' + (isActive ? ' class="active"' : '') + '>' + l[1] + '</a></li>';
                }).join('');
            }

            const bottomNavEl = document.querySelector('.bottom-nav-links');
            if (bottomNavEl) {
                bottomNavEl.innerHTML = bottomLinks.map(function (l) {
                    const isActive = isCurrentPage(l[0]);
                    return '<a href="' + l[0] + '" class="bottom-nav-item' + (isActive ? ' active' : '') + '">' +
                        '<span class="bottom-nav-icon"><svg width="22" height="22" aria-hidden="true"><use href="icons.svg#' + l[2] + '"></use></svg></span>' +
                        '<span class="bottom-nav-label">' + l[1] + '</span></a>';
                }).join('');
            }
        }

        const li = document.createElement('li');
        li.className = 'nav-auth-item';
        li.innerHTML = [
            '<span id="navChat" class="nav-chat-icon" title="Messages">',
            '  <svg width="20" height="20" aria-hidden="true"><use href="icons.svg#icon-chat"></use></svg>',
            '</span>',
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
            bellEl.addEventListener('click', async function (e) {
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
                    '<div id="veNotifList" style="text-align:center;padding:2rem 1rem;color:var(--text-secondary);">',
                    '  <p style="font-size:0.9rem;">Loading...</p>',
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

                const listEl = document.getElementById('veNotifList');
                const emptyState = [
                    '<div style="font-size:2rem;margin-bottom:0.75rem;">&#128276;</div>',
                    '<p style="font-size:0.9rem;line-height:1.6;">No notifications yet.</p>'
                ].join('');

                if (!myWorkshopId) {
                    listEl.innerHTML = emptyState;
                    return;
                }

                const { data: notifRows } = await _supabaseAuthNav
                    .from('workshop_notifications')
                    .select('id, submission_id, message, is_read, created_at')
                    .eq('workshop_id', myWorkshopId)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (!notifRows || notifRows.length === 0) {
                    listEl.innerHTML = emptyState;
                    return;
                }

                listEl.style.textAlign = 'left';
                listEl.style.padding = '0';
                listEl.innerHTML = notifRows.map(function (n) {
                    return [
                        '<a href="prices.html?report=' + encodeURIComponent(n.submission_id) + '" ',
                        '   data-notif-id="' + n.id + '" class="veNotifItem"',
                        '   style="display:block; padding:0.75rem; margin-bottom:0.5rem; border-radius:6px;',
                        '   background:' + (n.is_read ? 'transparent' : 'var(--bg-color)') + ';',
                        '   border:1px solid var(--border-color); text-decoration:none; color:var(--text-primary);">',
                        '  <p style="font-size:0.85rem; line-height:1.4;">' + escapeHtml(n.message) + '</p>',
                        '  <p style="font-size:0.72rem; color:var(--text-secondary); margin-top:0.3rem;">' + new Date(n.created_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</p>',
                        '</a>'
                    ].join('');
                }).join('');

                document.querySelectorAll('.veNotifItem').forEach(function (item) {
                    item.addEventListener('click', async function () {
                        const notifId = item.getAttribute('data-notif-id');
                        await _supabaseAuthNav.from('workshop_notifications').update({ is_read: true }).eq('id', notifId);
                    });
                });
            });
        }

        document.getElementById('navSignOutBtn').addEventListener('click',
            async function () {
                await _supabaseAuthNav.auth.signOut();
                window.location.reload();
            }
        );

        const chatEl = document.getElementById('navChat');
        if (chatEl) {
            chatEl.style.cursor = 'pointer';
            chatEl.addEventListener('click', function (e) {
                e.stopPropagation();
                window.location.href = myWorkshopId ? 'chat.html?mode=workshop' : 'chat.html';
            });
        }

if (myWorkshopId) {
            const lastLogin = session.user.last_sign_in_at;
            await checkUnreadBell(myWorkshopId, lastLogin, chatEl);
        }
      } finally {
        revealNav();
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
