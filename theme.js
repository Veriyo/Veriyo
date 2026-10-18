/* Apply before the stylesheet paints; a saved choice wins over the OS theme. */
(function () {
    let saved;
    try { saved = localStorage.getItem('veriyo-theme'); } catch (_) { /* Storage may be disabled. */ }
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : system;
})();
