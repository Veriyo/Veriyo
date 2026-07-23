
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
