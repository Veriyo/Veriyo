/**
 * Veriyo | List Workshop — Free Launch Registration
 * Handles auth check, workshop search, form validation, and direct submission.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseLW = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let lwSession = null;
    let addedServices = [];
    const SERVICE_LIMIT = 8;
    let searchResultsVisible = false;

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── WORKSHOP SEARCH ─────────────────────────────────────────────────────

    async function searchWorkshops() {
        const query = document.getElementById('workshopSearch').value.trim();
        const statusEl = document.getElementById('searchStatus');
        const resultsContainer = document.getElementById('searchResults');
        const resultsList = document.getElementById('resultsContainer');

        if (!query || query.length < 2) {
            statusEl.textContent = 'Please enter at least 2 characters.';
            statusEl.style.display = 'block';
            statusEl.style.color = 'var(--text-secondary)';
            return;
        }

        statusEl.textContent = 'Searching...';
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--text-secondary)';

        const { data, error } = await _supabaseLW
            .from('Workshopprofiles')
            .select('id, workshop_name, suburb, city, province, status')
            .ilike('workshop_name', '%' + query + '%')
            .limit(5);

        if (error) {
            statusEl.textContent = 'Search failed. Please try again.';
            statusEl.style.color = 'var(--danger-color)';
            return;
        }

        statusEl.style.display = 'none';
        searchResultsVisible = true;

        if (!data || data.length === 0) {
            resultsList.innerHTML = `
                <div style="text-align:center; padding:1.5rem; color:var(--text-secondary); background:var(--surface-color); border:1px solid var(--border-color); border-radius:var(--radius);">
                    <p style="margin-bottom:1rem;">No workshops found matching "<strong>${escapeHtml(query)}</strong>"</p>
                    <button type="button" id="createNewBtn" class="btn btn-primary" style="padding:0.75rem 1.5rem;">
                        Create New Workshop Listing
                    </button>
                </div>
            `;
            resultsContainer.style.display = 'block';
            document.getElementById('createNewBtn').addEventListener('click', showForm);
            return;
        }

        // Show matching workshops with claim option
        resultsList.innerHTML = data.map(w => {
            const location = [w.suburb, w.city, w.province].filter(Boolean).join(', ');
            const isApproved = w.status === 'Approved';
            return `
                <div style="background:var(--surface-color); border:1px solid var(--border-color); border-radius:var(--radius); padding:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem;">
                        <div>
                            <h4 style="font-size:1rem; margin-bottom:0.25rem;">${escapeHtml(w.workshop_name)}</h4>
                            <p style="color:var(--text-secondary); font-size:0.85rem;">${escapeHtml(location) || 'Location not specified'}</p>
                            ${isApproved ? '<span style="display:inline-block; background:rgba(34,197,94,0.15); color:var(--success-color); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600; margin-top:0.5rem;">Verified</span>' : ''}
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            ${isApproved ? `
                                <a href="claim-workshop.html?id=${w.id}" class="btn btn-secondary" style="font-size:0.85rem; padding:0.5rem 1rem;">
                                    Claim This Workshop
                                </a>
                            ` : `
                                <span style="color:var(--text-secondary); font-size:0.85rem; padding:0.5rem;">Pending review</span>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add "None of these match" option
        resultsList.innerHTML += `
            <div style="text-align:center; margin-top:1rem;">
                <button type="button" id="createNewBtn" class="btn btn-secondary" style="font-size:0.9rem;">
                    None of these match – Create New Listing
                </button>
            </div>
        `;

        resultsContainer.style.display = 'block';
        document.getElementById('createNewBtn').addEventListener('click', showForm);
    }

    function showForm() {
        document.getElementById('searchStep').style.display = 'none';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('formStep').style.display = 'block';
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
        const gp = document.getElementById('lwGuaranteePeriod').value.trim();

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
            specialisation: specs.join(', ') || null,
            years_operation: parseInt(document.getElementById('lwYears').value) || 0,
            rmi_registered: document.querySelector('input[name="lwRmi"]:checked')?.value || 'No',
            written_quote: document.querySelector('input[name="lwQuote"]:checked')?.value || 'No',
            guarantee_work: document.querySelector('input[name="lwGuarantee"]:checked')?.value || 'No',
            guarantee_period: gp || null,
            services: addedServices,
            plan: 'Dominant',
            plan_price: 0,
            status: 'Pending',
            source: 'Workshop Registered'
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
            document.getElementById('formStep').style.display = 'none';
            document.getElementById('lw-success-section').style.display = 'block';
        }
    }



    // ─── INIT ────────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async function () {
        const { data: { session } } = await _supabaseLW.auth.getSession();

if (!session) {
            document.getElementById('authRequiredSection').style.display = 'block';
            document.getElementById('mainContent').style.display = 'none';
            return;
        }

        lwSession = session;

        const emailDisplay = document.getElementById('lwEmailDisplay');
        if (emailDisplay) emailDisplay.textContent = session.user.email;

        renderServiceCards();


        // Search button
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', searchWorkshops);
        }

        // Enter key on search input
        const searchInput = document.getElementById('workshopSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchWorkshops();
                }
            });
        }

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
                submitListing(data);
            }
        });
    });
})();
