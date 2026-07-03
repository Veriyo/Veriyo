/**
 * Veriyo | List Workshop — Plan Selector & Registration
 * Handles plan tabs, Register/Features toggle, form validation, payment overlay.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseLW = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let activePlan = 'Visible';
    let activePlanPrice = 199;
    let activeSection = 'register';
    let selectedPaymentMethod = null;
    let pendingFormData = null;
    let lwSession = null;
    let addedServices = [];

    // ─── FEATURES CONTENT ───────────────────────────────────────────────────────

    const FEATURES = {
        Visible: [
            { text: 'Your workshop appears in the Veriyo directory', available: true },
            { text: 'Basic profile: name, location, specialisations, operating hours', available: true },
            { text: 'Motorist submissions mentioning your workshop are visible on your profile', available: true },
            { text: 'Receive email notifications when a motorist tried to contact you but chat was unavailable on your plan', available: true },
            {
                text: 'Chat with motorists',
                available: false,
                label: 'Not available on this plan'
            },
            {
                text: 'Respond to submissions',
                available: false,
                label: 'Not available on this plan'
            },
            {
                text: '"I Am Stuck" feature',
                available: false,
                label: 'Not available on this plan',
                detail: 'The I Am Stuck feature connects stranded motorists with nearby workshops in real time. Only Dominant workshops appear in these urgent requests.'
            }
        ],
        Trusted: [
            { text: 'Everything in Visible, plus:', available: true, heading: true },
            { text: 'Chat enabled — motorists can initiate conversations with your workshop directly', available: true },
            { text: 'Respond officially to motorist submissions mentioning your workshop (200 characters per response)', available: true },
            { text: 'Service pricing displayed on your profile with "Prices verified by workshop" label', available: true },
            {
                text: 'Competitive pricing indicator',
                available: true,
                detail: 'We compare your listed prices to verified submissions in your area. If you are below average you automatically receive a Competitively Priced badge visible to all motorists.'
            },
            { text: '"Get a Quote" requests — motorists can send repair requests directly to your workshop', available: true },
            { text: 'Priority placement above Visible workshops in search results', available: true },
            {
                text: '"I Am Stuck" feature',
                available: false,
                label: 'Not available on this plan'
            }
        ],
        Dominant: [
            { text: 'Everything in Trusted, plus:', available: true, heading: true },
            {
                text: '"I Am Stuck" visibility — your workshop appears exclusively to motorists in active distress nearby',
                available: true,
                detail: 'When a motorist is stranded and needs urgent help, they trigger the I Am Stuck feature. Only Dominant workshops in their area appear. These are the highest-intent customers on the platform — they need help right now and are not price shopping.'
            },
            { text: 'Photo verification in chat — motorists can send images of their vehicle before you commit to assisting', available: true },
            { text: 'Precise workshop location on your profile with interactive map and "Navigate here" button', available: true },
            {
                text: 'Exclusive area lock — only one Dominant workshop per suburb. First to claim owns that position',
                available: true,
                detail: 'Once you claim Dominant for your suburb, no other workshop can take the top spot in that area. If your suburb is already claimed, contact us to join the waitlist.'
            },
            { text: 'Featured placement — pinned above all other workshops in your suburb and city', available: true },
            { text: 'Gold "Featured" banner on your workshop card', available: true },
            { text: 'Monthly missed-opportunity report — how many motorists searched your suburb, what repairs they needed, what prices were paid', available: true },
            { text: 'Promotion slot — one active promotion displayed on your profile at all times', available: true },
            { text: 'Repair status tracker — update motorists on their repair progress through the platform', available: true }
        ]
    };

    function buildFeaturesHTML(plan) {
        const items = FEATURES[plan] || [];
        const priceMap = { Visible: 199, Trusted: 499, Dominant: 999 };
        const price = priceMap[plan];

        let html = `<div class="lw-features-wrap">
            <div class="lw-features-header">
                <h2 class="lw-features-title">${escapeHtml(plan)} Plan</h2>
                <p class="lw-features-price">R${price}<span>/month</span></p>
            </div>
            <ul class="features-list">`;

        items.forEach(function (item) {
            const icon = item.available ? '&#10003;' : '&#10007;';
            const cls = item.available ? 'feature-item--available' : 'feature-item--unavailable';
            const headingCls = item.heading ? ' feature-item--heading' : '';

            html += `<li class="feature-item ${cls}${headingCls}">
                <span class="feature-icon">${icon}</span>
                <span class="feature-text">${escapeHtml(item.text)}`;

            if (!item.available && item.label) {
                html += ` <em class="feature-na-label">${escapeHtml(item.label)}</em>`;
            }

            if (item.detail) {
                html += `<details class="feature-dropdown">
                    <summary class="feature-dropdown-toggle">Learn more</summary>
                    <p class="feature-dropdown-body">${escapeHtml(item.detail)}</p>
                </details>`;
            }

            html += `</span></li>`;
        });

        html += `</ul>
            <a href="#" class="btn btn-primary lw-features-cta" id="lwFeaturesCta_${plan}" style="display:inline-block; margin-top:1.5rem;">
                Register for ${escapeHtml(plan)} — R${price}/month
            </a>
        </div>`;

        return html;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── PLAN TAB SWITCHING ──────────────────────────────────────────────────────

    function activatePlanTab(plan, price) {
        activePlan = plan;
        activePlanPrice = price;

        document.querySelectorAll('.plan-tab-btn').forEach(function (btn) {
            btn.classList.toggle('plan-tab-btn--active', btn.dataset.plan === plan);
        });

        document.getElementById('lwPlanNameBanner').textContent = plan;
        document.getElementById('lwPlanPriceBanner').textContent = price;

        updateServiceLimitDisplay();
        renderFeaturesForActivePlan();
    }

    function renderFeaturesForActivePlan() {
        ['Visible', 'Trusted', 'Dominant'].forEach(function (p) {
            const el = document.getElementById('lw-features-' + p.toLowerCase());
            if (el) {
                el.style.display = p === activePlan ? 'block' : 'none';
                if (p === activePlan && !el.dataset.built) {
                    el.innerHTML = buildFeaturesHTML(p);
                    el.dataset.built = '1';
                    const cta = document.getElementById('lwFeaturesCta_' + p);
                    if (cta) {
                        cta.addEventListener('click', function (e) {
                            e.preventDefault();
                            switchSection('register');
                            document.querySelector('.plan-subnav-link[data-section="register"]').click();
                        });
                    }
                }
            }
        });
    }

    // ─── SUBSECTION SWITCHING ────────────────────────────────────────────────────

    function switchSection(section) {
        activeSection = section;
        document.querySelectorAll('.plan-subnav-link').forEach(function (link) {
            link.classList.toggle('plan-subnav-link--active', link.dataset.section === section);
        });
        document.getElementById('lw-register-section').style.display = section === 'register' ? 'block' : 'none';
        document.getElementById('lw-features-section').style.display = section === 'features' ? 'block' : 'none';
    }

    // ─── SERVICES MANAGEMENT ─────────────────────────────────────────────────────

    function getServiceLimit() {
        if (activePlan === 'Visible') return 3;
        return 8;
    }

    function updateServiceLimitDisplay() {
        const limitEl = document.getElementById('lwServiceLimitNum');
        if (limitEl) limitEl.textContent = getServiceLimit();
        renderServiceCards();
    }

    function renderServiceCards() {
        const container = document.getElementById('lwServiceCards');
        if (!container) return;
        const limit = getServiceLimit();
        container.innerHTML = '';

        addedServices.forEach(function (svc, idx) {
            const card = document.createElement('div');
            card.className = 'lw-service-card';
            card.innerHTML =
                '<span class="lw-service-card-name">' + escapeHtml(svc.service) + '</span>' +
                '<span class="lw-service-card-price">R' + Number(svc.price).toLocaleString() + '</span>' +
                '<button type="button" class="lw-service-card-remove" data-idx="' + idx + '" aria-label="Remove service">&#10005;</button>';
            container.appendChild(card);
        });

        container.querySelectorAll('.lw-service-card-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                addedServices.splice(parseInt(btn.dataset.idx), 1);
                renderServiceCards();
            });
        });

        const addRow = document.getElementById('lwServiceAddRow');
        const limitMsg = document.getElementById('lwServiceLimitMsg');
        if (addedServices.length >= limit) {
            if (addRow) addRow.style.display = 'none';
            if (limitMsg) limitMsg.style.display = 'block';
        } else {
            if (addRow) addRow.style.display = 'flex';
            if (limitMsg) limitMsg.style.display = 'none';
        }
    }

    function addService() {
        const selectEl = document.getElementById('lwServiceSelect');
        const customEl = document.getElementById('lwServiceCustom');
        const priceEl = document.getElementById('lwServicePrice');
        if (!selectEl || !priceEl) return;

        let serviceName = selectEl.value;
        if (!serviceName) { selectEl.focus(); return; }
        if (serviceName === 'custom') {
            serviceName = customEl ? customEl.value.trim() : '';
            if (!serviceName) { if (customEl) customEl.focus(); return; }
        }

        const price = parseInt(priceEl.value);
        if (!price || price <= 0) { priceEl.focus(); return; }
        if (addedServices.length >= getServiceLimit()) return;

        addedServices.push({ service: serviceName, price: price });
        renderServiceCards();

        priceEl.value = '';
        if (selectEl.value === 'custom' && customEl) customEl.value = '';
    }

    // ─── LOCATION AUTO-FILL ───────────────────────────────────────────────────────

    function initLocationButton() {
        const btn = document.getElementById('lwUseLocation');
        const statusEl = document.getElementById('lwLocationStatus');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                statusEl.textContent = 'Geolocation is not supported by your browser.';
                statusEl.style.display = 'block';
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Locating…';
            statusEl.textContent = 'Getting your location…';
            statusEl.style.display = 'block';

            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    fetch(
                        'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lng,
                        { headers: { 'User-Agent': 'Veriyo/1.0' } }
                    )
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        const addr = data.address || {};
                        const suburb = addr.suburb || addr.village || addr.neighbourhood || '';
                        const city = addr.city || addr.town || addr.municipality || '';
                        const province = addr.state || '';

                        if (suburb) document.getElementById('lwSuburb').value = suburb;
                        if (city) document.getElementById('lwCity').value = city;
                        if (province) {
                            const sel = document.getElementById('lwProvince');
                            for (let i = 0; i < sel.options.length; i++) {
                                if (sel.options[i].value.toLowerCase() === province.toLowerCase()) {
                                    sel.selectedIndex = i;
                                    break;
                                }
                            }
                        }
                        statusEl.textContent = 'Location filled. You can edit the fields above.';
                        btn.disabled = false;
                        btn.textContent = '&#127759; Use My Location';
                    })
                    .catch(function () {
                        statusEl.textContent = 'Could not fetch address. Please fill in manually.';
                        btn.disabled = false;
                        btn.textContent = '&#127759; Use My Location';
                    });
                },
                function () {
                    statusEl.textContent = 'Location access denied. Please fill in manually.';
                    btn.disabled = false;
                    btn.textContent = '&#127759; Use My Location';
                }
            );
        });
    }

    // ─── FORM VALIDATION & SUBMISSION ───────────────────────────────────────────

    function collectFormData() {
        const specs = Array.from(document.querySelectorAll('input[name="lwSpec"]:checked')).map(function (el) { return el.value; });
        return {
            workshop_name: document.getElementById('lwName').value.trim(),
            physical_address: document.getElementById('lwAddress').value.trim(),
            suburb: document.getElementById('lwSuburb').value.trim(),
            city: document.getElementById('lwCity').value.trim(),
            province: document.getElementById('lwProvince').value,
            contact_number: document.getElementById('lwContact').value.trim(),
            email_address: lwSession ? lwSession.user.email : '',
            user_id: lwSession ? lwSession.user.id : null,
            operating_hours: document.getElementById('lwHours').value.trim(),
            specialisation: specs.join(', '),
            years_operation: parseInt(document.getElementById('lwYears').value) || 0,
            rmi_registered: document.querySelector('input[name="lwRmi"]:checked')?.value || 'No',
            written_quote: document.querySelector('input[name="lwQuote"]:checked')?.value || 'No',
            guarantee_work: document.querySelector('input[name="lwGuarantee"]:checked')?.value || 'No',
            guarantee_period: document.getElementById('lwGuaranteePeriod').value.trim() || null,
            services: JSON.stringify(addedServices),
            plan: activePlan,
            plan_price: activePlanPrice,
            status: 'Payment Pending'
        };
    }

    function validateForm(data) {
        const errorEl = document.getElementById('lwFormError');
        errorEl.style.display = 'none';

        if (!data.workshop_name) { showFormError('Workshop name is required.'); return false; }
        if (!data.physical_address) { showFormError('Physical address is required.'); return false; }
        if (!data.suburb) { showFormError('Suburb is required.'); return false; }
        if (!data.city) { showFormError('City is required.'); return false; }
        if (!data.province) { showFormError('Please select a province.'); return false; }
        if (!data.contact_number) { showFormError('Contact number is required.'); return false; }
        if (!data.operating_hours) { showFormError('Operating hours are required.'); return false; }

        const consent = document.getElementById('lwConsent');
        if (!consent.checked) {
            document.getElementById('lwConsentError').style.display = 'block';
            return false;
        }
        document.getElementById('lwConsentError').style.display = 'none';

        return true;
    }

    function showFormError(msg) {
        const el = document.getElementById('lwFormError');
        el.textContent = msg;
        el.style.display = 'block';
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ─── PAYMENT OVERLAY ─────────────────────────────────────────────────────────

    function openPaymentOverlay(data) {
        pendingFormData = data;
        selectedPaymentMethod = null;

        document.getElementById('lwPaymentSub').textContent =
            'Choose how you would like to pay for your ' + activePlan + ' plan at R' + activePlanPrice + '/month.';

        document.querySelectorAll('.lw-payment-card').forEach(function (card) {
            card.classList.remove('lw-payment-card--selected');
        });
        document.getElementById('lwPaymentConfirm').disabled = true;
        document.getElementById('lwPaymentError').style.display = 'none';
        document.getElementById('lwPaymentOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closePaymentOverlay() {
        document.getElementById('lwPaymentOverlay').style.display = 'none';
        document.body.style.overflow = '';
    }

    async function submitListing() {
        if (!pendingFormData || !selectedPaymentMethod) return;

        const confirmBtn = document.getElementById('lwPaymentConfirm');
        const errorEl = document.getElementById('lwPaymentError');
        errorEl.style.display = 'none';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Submitting…';

        const insertData = Object.assign({}, pendingFormData, { payment_method: selectedPaymentMethod });

        const { error } = await _supabaseLW.from('Workshopprofiles').insert(insertData);

        if (error) {
            errorEl.textContent = 'Submission failed: ' + error.message + '. Please try again.';
            errorEl.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm & Submit Listing';
        } else {
            closePaymentOverlay();
            document.getElementById('lw-register-section').style.display = 'none';
            document.getElementById('lw-features-section').style.display = 'none';
            document.getElementById('lw-success-section').style.display = 'block';
            document.querySelector('.plan-subnav').style.display = 'none';
            document.querySelector('.plan-tabs-nav').style.display = 'none';
        }
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async function () {

        // Auth check — redirect to sign-in if not logged in
        const { data: { session } } = await _supabaseLW.auth.getSession();
        if (!session) {
            window.location.href = 'auth.html';
            return;
        }
        lwSession = session;

        // Populate email display
        const emailDisplay = document.getElementById('lwEmailDisplay');
        if (emailDisplay) emailDisplay.textContent = session.user.email;

        // Build initial features panels
        renderFeaturesForActivePlan();
        updateServiceLimitDisplay();

        // Plan tab clicks
        document.querySelectorAll('.plan-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activatePlanTab(btn.dataset.plan, parseInt(btn.dataset.price));
                if (activeSection === 'features') {
                    renderFeaturesForActivePlan();
                }
            });
        });

        // Sub-section links
        document.querySelectorAll('.plan-subnav-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                switchSection(link.dataset.section);
            });
        });

        // Guarantee period toggle
        document.querySelectorAll('input[name="lwGuarantee"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                const wrap = document.getElementById('lwGuaranteePeriodWrap');
                if (this.value === 'Yes') {
                    wrap.classList.remove('hidden');
                } else {
                    wrap.classList.add('hidden');
                }
            });
        });

        // Service select toggle custom input
        const serviceSelect = document.getElementById('lwServiceSelect');
        if (serviceSelect) {
            serviceSelect.addEventListener('change', function () {
                const customWrap = document.getElementById('lwServiceCustomWrap');
                if (customWrap) {
                    customWrap.style.display = this.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        // Add service button
        const addServiceBtn = document.getElementById('lwAddServiceBtn');
        if (addServiceBtn) {
            addServiceBtn.addEventListener('click', addService);
        }

        // Location button
        initLocationButton();

        // Form submit
        document.getElementById('lwForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const data = collectFormData();
            if (validateForm(data)) {
                openPaymentOverlay(data);
            }
        });

        // Payment card selection
        document.querySelectorAll('.lw-payment-card').forEach(function (card) {
            card.addEventListener('click', function () {
                document.querySelectorAll('.lw-payment-card').forEach(function (c) {
                    c.classList.remove('lw-payment-card--selected');
                });
                card.classList.add('lw-payment-card--selected');
                selectedPaymentMethod = card.dataset.method;
                document.getElementById('lwPaymentConfirm').disabled = false;
            });
        });

        // Payment confirm
        document.getElementById('lwPaymentConfirm').addEventListener('click', submitListing);

        // Payment cancel
        document.getElementById('lwPaymentCancel').addEventListener('click', closePaymentOverlay);

        // Close overlay on backdrop click
        document.getElementById('lwPaymentOverlay').addEventListener('click', function (e) {
            if (e.target === this) closePaymentOverlay();
        });

        // Pre-select Visible tab
        activatePlanTab('Visible', 199);
    });
})();
