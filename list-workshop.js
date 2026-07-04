/**
 * Veriyo | List Workshop — Free Launch Registration
 * Handles auth check, form validation, and direct submission (no payment).
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseLW = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let lwSession = null;
    let addedServices = [];
    const SERVICE_LIMIT = 8; // All plans get full features during free launch

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── SERVICES MANAGEMENT ─────────────────────────────────────────────────────

    function renderServiceCards() {
        const container = document.getElementById('lwServiceCards');
        if (!container) return;
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
        if (addedServices.length >= SERVICE_LIMIT) {
            if (addRow) addRow.style.display = 'none';
        } else {
            if (addRow) addRow.style.display = 'flex';
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
        if (addedServices.length >= SERVICE_LIMIT) return;

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
            plan: 'Dominant', // All features during free launch
            plan_price: 0, // Free during launch
            status: 'Pending' // Awaiting admin approval
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

    async function submitListing(data) {
        const submitBtn = document.getElementById('lwSubmitBtn');
        const errorEl = document.getElementById('lwFormError');
        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting…';

        const { error } = await _supabaseLW.from('Workshopprofiles').insert(data);

        if (error) {
            errorEl.textContent = 'Submission failed: ' + error.message + '. Please try again.';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Listing for Review';
        } else {
            // Show success
            document.querySelector('.form-container').style.display = 'none';
            document.getElementById('lw-success-section').style.display = 'block';
        }
    }

    // ─── AUTH & BOTTOM NAV CHECK ────────────────────────────────────────────────

    async function checkSessionForBottomNav() {
        const { data: { session } } = await _supabaseLW.auth.getSession();
        const myListingNav = document.getElementById('bottomNavMyListing');
        if (session && myListingNav) {
            myListingNav.style.display = '';
        } else if (myListingNav) {
            myListingNav.style.display = 'none';
        }
    }

    // ─── INIT ────────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async function () {
        // Check for session
        const { data: { session } } = await _supabaseLW.auth.getSession();

        if (!session) {
            // Show auth required message, hide form
            document.getElementById('authRequiredSection').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
            checkSessionForBottomNav();
            return;
        }

        lwSession = session;

        // Populate email display
        const emailDisplay = document.getElementById('lwEmailDisplay');
        if (emailDisplay) emailDisplay.textContent = session.user.email;

        renderServiceCards();
        checkSessionForBottomNav();

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

        // Form submit - direct submission without payment
        document.getElementById('lwForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const data = collectFormData();
            if (validateForm(data)) {
                submitListing(data);
            }
        });
    });
})();
