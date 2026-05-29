/**
 * Veriyo | Built for South African drivers
 * Global Framework Architecture & Navigation Operations
 */

// ── Veriyo Alerts via ntfy.sh ──────────────────────────────
const NTFY_TOPIC = 'veriyo-alerts-g71f25'; // must match what you typed in the app

function sendAlert(message) {
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        body: message
    }).catch(() => {});
}
// ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initNavigationHandlers();

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const visitTime = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
    sendAlert(`Visit on ${currentPage} at ${visitTime}`);
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
    const localPathname = window.location.pathname;
    const currentFileName = localPathname.substring(localPathname.lastIndexOf('/') + 1);
    const elementsToMap = document.querySelectorAll('.nav-links a');

    elementsToMap.forEach(linkAnchor => {
        const structuralTarget = linkAnchor.getAttribute('href');
        if (currentFileName === structuralTarget || (currentFileName === '' && structuralTarget === 'index.html')) {
            linkAnchor.classList.add('active');
        } else {
            linkAnchor.classList.remove('active');
        }
    });
}
