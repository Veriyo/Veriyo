/**
 * Veriyo | Built for South African drivers
 * Global Framework Architecture & Navigation Operations
 */

// ── Veriyo Alerts via ntfy.sh ──────────────────────────────
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1520683709831974952/kFbtGbEcC8-dh2aaox4s3lGUL_pOQ_oKO2Euaq_5T3GS-tXm6a6fcQ5P91sIa2Ov7Jjq';
function sendAlert(message) {
    fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
    }).catch(() => {});
}
// ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initNavigationHandlers();

    // Only fire alert if user stays on page for 4 seconds — filters bots and refreshes
    setTimeout(() => {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const visitTime = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
        sendAlert(`Visit on ${currentPage} at ${visitTime}`);
    }, 4000);
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
