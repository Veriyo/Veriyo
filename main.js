
/**
 * Veriyo | Built for South African drivers
 * Global Framework Architecture & Navigation Operations
 */

(function () {
    const ERROR_LOG_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co/rest/v1/error_logs';
    const ERROR_LOG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    let alreadyReportedThisPage = false;

    function showGenericErrorBanner() {
        const inject = function () {
            if (document.getElementById('veriyoGlobalErrorBanner')) return;
            const banner = document.createElement('div');
            banner.id = 'veriyoGlobalErrorBanner';
            banner.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:9999; background:#b91c1c; color:#fff; text-align:center; padding:0.75rem 1rem; font-size:0.9rem;';
            banner.textContent = 'Something went wrong on this page. Our team has been notified — please try refreshing.';
            document.body.appendChild(banner);
        };
        if (document.body) inject();
        else document.addEventListener('DOMContentLoaded', inject);
    }

    function reportError(message, stack) {
        if (alreadyReportedThisPage) return;
        alreadyReportedThisPage = true;
        showGenericErrorBanner();
        fetch(ERROR_LOG_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': ERROR_LOG_KEY,
                'Authorization': 'Bearer ' + ERROR_LOG_KEY
            },
            body: JSON.stringify({
                message: String(message || 'Unknown error').slice(0, 2000),
                stack: String(stack || '').slice(0, 4000),
                page_url: window.location.href,
                user_agent: navigator.userAgent
            })
        }).catch(function () { /* if the report itself fails, there's nothing more to do */ });
    }

    window.addEventListener('error', function (event) {
        reportError(event.message, event.error && event.error.stack);
    });
    window.addEventListener('unhandledrejection', function (event) {
        const reason = event.reason;
        reportError(reason && reason.message ? reason.message : String(reason), reason && reason.stack);
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    initNavigationHandlers();
});

/**
 * Orchestrates navigation execution across viewports and highlights current routing.
 */
function initNavigationHandlers() {
    const hamburgerBtn = document.getElementById('hamburgerToggle');
    const navLinksContainer = document.getElementById('navLinksContainer');

    // Toggle Mobile Drawer View via Hamburger
    if (hamburgerBtn && navLinksContainer) {
        hamburgerBtn.addEventListener('click', () => {
            navLinksContainer.classList.toggle('active');
            hamburgerBtn.classList.toggle('open');
            
            // Basic UI Transformation for active menu states
            const spans = hamburgerBtn.querySelectorAll('span');
            if(hamburgerBtn.classList.contains('open')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
  }
        });
    }

    // Set active link configuration by tracking current resource location paths
    const currentUrl = window.location.href.split('?')[0].split('#')[0]; 
    const elementsToMap = document.querySelectorAll('.nav-links a');

    elementsToMap.forEach(linkAnchor => {
        // Resolve absolute URL natively via the DOM and create a clean extensionless variant
        const linkUrl = linkAnchor.href.split('?')[0].split('#')[0];
        const cleanLinkUrl = linkUrl.replace('.html', '');
        
        // Match exact URL, extensionless URL, or root directory index mapping
        if (currentUrl === linkUrl || currentUrl === cleanLinkUrl || (currentUrl.endsWith('/') && linkUrl.endsWith('index.html'))) {
            linkAnchor.classList.add('active');
        } else {
            linkAnchor.classList.remove('active');
        }
    });
}

/* Shared Veriyo shell: no dependency on authentication or a network request. */
document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.querySelector('.navbar--top');
    if (!navbar) return;
    const page = location.pathname.split('/').pop().replace(/\.html$/, '');
    const normalise = href => new URL(href, location.href).pathname.replace(/\.html$/, '').replace(/\/$/, '');
    const icon = name => '<svg width="21" height="21" aria-hidden="true"><use href="icons.svg#' + name + '"></use></svg>';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'veriyo-menu-toggle';
    button.setAttribute('aria-label', 'Open navigation menu');
    button.setAttribute('aria-controls', 'veriyoSideMenu');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    navbar.prepend(button);

    const themeButton = document.createElement('button');
    themeButton.type = 'button';
    themeButton.className = 'veriyo-theme-toggle';
    navbar.append(themeButton);
    function updateThemeButton() {
        const light = document.documentElement.dataset.theme === 'light';
        themeButton.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
        themeButton.title = themeButton.getAttribute('aria-label');
        themeButton.innerHTML = light
            ? '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/></svg>'
            : '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
    }
    themeButton.addEventListener('click', function () {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('veriyo-theme', next); } catch (_) { /* Still usable without persistence. */ }
        updateThemeButton();
    });
    window.addEventListener('storage', function (event) {
        if (event.key === 'veriyo-theme' && ['light', 'dark'].includes(event.newValue)) {
            document.documentElement.dataset.theme = event.newValue;
            updateThemeButton();
        }
    });
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (event) {
        let saved;
        try { saved = localStorage.getItem('veriyo-theme'); } catch (_) { /* Use system preference. */ }
        if (!['light', 'dark'].includes(saved)) {
            document.documentElement.dataset.theme = event.matches ? 'light' : 'dark';
            updateThemeButton();
        }
    });
    updateThemeButton();

    const drawer = document.createElement('dialog');
    drawer.id = 'veriyoSideMenu';
    drawer.className = 'veriyo-side-menu';
    drawer.setAttribute('aria-labelledby', 'veriyoMenuTitle');
    drawer.innerHTML = '<div class="veriyo-menu-heading"><h2 id="veriyoMenuTitle">Explore Veriyo</h2><button type="button" class="veriyo-menu-close" aria-label="Close navigation menu">&times;</button></div>' +
        '<p class="veriyo-menu-intro">Better information. Fairer repairs.</p><nav aria-label="Side menu" class="veriyo-side-links"></nav>' +
        '<div class="veriyo-menu-footer">Built for South African drivers.</div>';
    document.body.append(drawer);
    button.addEventListener('click', function () { drawer.showModal(); button.setAttribute('aria-expanded', 'true'); });
    drawer.querySelector('button').addEventListener('click', () => drawer.close());
    drawer.addEventListener('click', function (event) {
        if (event.target === drawer) {
            const rect = drawer.getBoundingClientRect();
            if (event.clientX > rect.right || event.clientX < rect.left) drawer.close();
        }
        if (event.target.closest('a')) drawer.close();
    });
    drawer.addEventListener('close', function () { button.setAttribute('aria-expanded', 'false'); button.focus(); });

    function syncNavigation() {
        const top = navbar.querySelector('.nav-links');
        const bottom = document.querySelector('.bottom-nav-links');
        const source = top && top.querySelector('a') ? top : bottom;
        let entries = source ? Array.from(source.querySelectorAll('a')).filter(a => a.id !== 'navChat').map(a => [a.getAttribute('href'), a.textContent.trim()]) : [];
        if (!entries.length) entries = [['motorist-home.html', 'For motorists'], ['workshop-home.html', 'For workshops']];
        const workshopMode = entries.some(e => /my-listing|workshop-home/.test(e[0])) && !entries.some(e => /motorist-home/.test(e[0])) || new URLSearchParams(location.search).get('mode') === 'workshop';
        const chatHref = workshopMode ? 'chat.html?mode=workshop' : 'chat.html';
        entries = entries.filter(e => !/^chat(?:\.html)?(?:\?|$)/.test(e[0]));
        entries.push([chatHref, 'Messages'], ['help.html', 'Help & support'], ['privacy.html', 'Privacy policy']);
        const nav = drawer.querySelector('nav');
        nav.replaceChildren();
        const seen = new Set();
        entries.forEach(function ([href, label]) {
            if (seen.has(href)) return;
            seen.add(href);
            const link = document.createElement('a');
            link.href = href;
            link.textContent = label;
            if (normalise(href) === normalise(location.href)) link.setAttribute('aria-current', 'page');
            nav.append(link);
        });
        if (top) top.style.visibility = 'visible';
        if (bottom) {
            let chat = bottom.querySelector('#navChat');
            if (!chat) {
                chat = document.createElement('a');
                chat.id = 'navChat';
                chat.className = 'bottom-nav-item';
                chat.innerHTML = '<span class="bottom-nav-icon">' + icon('icon-chat') + '</span><span class="bottom-nav-label">Messages</span>';
                bottom.append(chat);
            }
            chat.href = chatHref;
            bottom.style.visibility = 'visible';
            bottom.closest('.bottom-nav').setAttribute('aria-label', 'Main navigation');
            bottom.querySelectorAll('a').forEach(function (link) {
                const active = normalise(link.href) === normalise(location.href);
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
        }
    }
    syncNavigation();
    document.addEventListener('veriyo:navigation-ready', syncNavigation);
    document.body.classList.add('veriyo-shell');
    if (['motorist-home', 'workshop-home', 'welcome', 'chat'].includes(page)) document.body.classList.add('veriyo-page-' + page);
});
