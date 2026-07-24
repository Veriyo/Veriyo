/**
 * Veriyo | Workshop Directory
 * Fetches approved workshops, calculates star ratings, renders filterable grid.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseWD = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Paused until there's enough traffic to justify it — set this back to
    // true to re-enable Dominant-tier sorting, badges, and highlighting.
    // Nothing else below needs to change.
const DOMINANT_PLAN_ENABLED = true;
    const PLAN_ORDER = { 'Dominant': 3, 'Trusted': 2, 'Visible': 1 };

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildStars(avg) {
        if (!avg && avg !== 0) return '';
        const rounded = Math.round(avg);
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += i <= rounded ? '&#9733;' : '&#9734;';
        }
        return html;
    }

function buildPlanBadge(plan) {
        if (!DOMINANT_PLAN_ENABLED) return '';
        if (!plan || !plan.trim()) return '';
        const p = plan.trim();
        const cls = p === 'Dominant' ? 'wd-plan-badge--dominant'
            : p === 'Trusted' ? 'wd-plan-badge--trusted'
            : 'wd-plan-badge--visible';
        return `<span class="wd-plan-badge ${cls}">${escapeHtml(p)}</span>`;
    }

function buildCard(w, avgRating) {
        const isDominant = DOMINANT_PLAN_ENABLED && (w.plan || '').trim() === 'Dominant';
        const stars = (avgRating !== null && avgRating !== undefined)
            ? `<div class="wd-card-stars rating-stars">${buildStars(avgRating)}</div>`
            : '';
        const dominantBanner = isDominant
            ? '<div class="wd-featured-banner">&#11088; Featured</div>'
            : '';
        const location = [w.suburb, w.city, w.province].filter(Boolean).join(', ');

        return `
        <article class="wd-card${isDominant ? ' wd-card--dominant' : ''}" 
            role="button" tabindex="0"
            data-name="${escapeHtml(w.workshop_name || '')}"
            data-suburb="${escapeHtml(w.suburb || '')}"
            data-city="${escapeHtml(w.city || '')}"
            data-province="${escapeHtml(w.province || '')}"
            onclick="window.location.href='workshop-profile.html?id=${w.id}'"
            onkeydown="if(event.key==='Enter'||event.key===' ')window.location.href='workshop-profile.html?id=${w.id}'">
            ${dominantBanner}
            <div class="wd-card-body">
                <div class="wd-card-top">
                    <h2 class="wd-card-name">${escapeHtml(w.workshop_name || 'Unnamed Workshop')}</h2>
                    ${buildPlanBadge(w.plan)}
                </div>
                <p class="wd-card-location">${escapeHtml(location)}</p>
                ${stars}
                ${w.specialisation ? `<p class="wd-card-spec">${escapeHtml(w.specialisation)}</p>` : ''}
            </div>
        </article>`;
    }

    function calcRatings(workshops, submissions) {
        const ratingMap = {};
        submissions.forEach(function (sub) {
            if (!sub.rating || sub.rating < 1) return;
            const wName = (sub.workshop_name || '').toLowerCase().trim();
            const wSuburb = (sub.suburb || '').toLowerCase().trim();
            workshops.forEach(function (w) {
                const mName = (w.workshop_name || '').toLowerCase().trim();
                const mSuburb = (w.suburb || '').toLowerCase().trim();
                if (wName === mName && wSuburb === mSuburb) {
                    if (!ratingMap[w.id]) ratingMap[w.id] = [];
                    ratingMap[w.id].push(sub.rating);
                }
            });
        });
        const avgMap = {};
        Object.keys(ratingMap).forEach(function (id) {
            const vals = ratingMap[id];
            avgMap[id] = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        });
        return avgMap;
    }

function sortWorkshops(workshops, avgMap) {
        return workshops.slice().sort(function (a, b) {
            const pa = DOMINANT_PLAN_ENABLED ? (PLAN_ORDER[a.plan] || 0) : 0;
            const pb = DOMINANT_PLAN_ENABLED ? (PLAN_ORDER[b.plan] || 0) : 0;
            if (pb !== pa) return pb - pa;
            const ra = avgMap[a.id] || 0;
            const rb = avgMap[b.id] || 0;
            return rb - ra;
        });
    }

    let allWorkshops = [];
    let avgRatingMap = {};

    function renderGrid(workshops) {
        const grid = document.getElementById('wdGrid');
        const emptyEl = document.getElementById('wdEmpty');

        if (!workshops || workshops.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';
        grid.style.display = 'grid';
        grid.innerHTML = workshops.map(function (w) {
            return buildCard(w, avgRatingMap[w.id]);
        }).join('');
    }

    function applyFilters() {
        const query = (document.getElementById('wdSearch').value || '').toLowerCase().trim();
        const province = document.getElementById('wdProvince').value || '';

        let filtered = allWorkshops;

        if (province) {
            filtered = filtered.filter(function (w) {
                return (w.province || '') === province;
            });
        }

        if (query) {
            filtered = filtered.filter(function (w) {
                return (w.workshop_name || '').toLowerCase().includes(query)
                    || (w.suburb || '').toLowerCase().includes(query)
                    || (w.city || '').toLowerCase().includes(query);
            });
        }

        renderGrid(filtered);
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const [wsResult, subResult] = await Promise.all([
            _supabaseWD.from('Workshopprofiles').select('*').eq('status', 'Approved'),
            _supabaseWD.from('Submissions').select('workshop_name, suburb, rating').eq('status', 'Approved')
        ]);

        document.getElementById('wdLoading').style.display = 'none';

        const workshops = wsResult.data || [];
        const submissions = subResult.data || [];

        avgRatingMap = calcRatings(workshops, submissions);
        allWorkshops = sortWorkshops(workshops, avgRatingMap);

        renderGrid(allWorkshops);

        document.getElementById('wdSearch').addEventListener('input', applyFilters);
        document.getElementById('wdProvince').addEventListener('change', applyFilters);

        document.getElementById('wdShareBtn').addEventListener('click', function () {
            navigator.clipboard.writeText('https://veriyo.co.za/list-workshop.html').then(function () {
                const confirm = document.getElementById('wdShareConfirm');
                confirm.style.display = 'inline-block';
                setTimeout(function () { confirm.style.display = 'none'; }, 3000);
            }).catch(function () {
                prompt('Copy this link:', 'https://veriyo.co.za/list-workshop.html');
            });
        });
    });
})();
