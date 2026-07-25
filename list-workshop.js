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
    // Plan-gated service cap. New signups are always on the free Visible
    // plan (3), so that's the default; editing an existing paid listing
    // raises this once populateFormForEdit sees the real plan.
    let SERVICE_LIMIT = 3;
    const SERVICE_LIMIT_BY_PLAN = { Visible: 3, Trusted: 8, Dominant: 25 };
    let searchResultsVisible = false;
    let editingListingId = null;
    let selectedPhotoFile = null;
    let existingPhotoUrl = null;
function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function uploadWorkshopPhoto(file, workshopId) {
        const fileName = workshopId + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const { error } = await _supabaseLW.storage
            .from('workshop-photos')
            .upload(fileName, file);
        if (error) {
            console.error('Photo upload error:', error);
            return null;
        }
        return _supabaseLW.storage.from('workshop-photos').getPublicUrl(fileName).data.publicUrl;
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
        let limitHint = document.getElementById('lwServiceLimitHint');
        if (addedServices.length >= SERVICE_LIMIT) {
            if (addRow) addRow.style.display = 'none';
            if (!limitHint && addRow && addRow.parentNode) {
                limitHint = document.createElement('p');
                limitHint.id = 'lwServiceLimitHint';
                limitHint.style.cssText = 'font-size:0.8rem; color:var(--text-secondary); margin-top:0.5rem;';
                addRow.parentNode.insertBefore(limitHint, addRow.nextSibling);
            }
            if (limitHint) {
                limitHint.textContent = SERVICE_LIMIT >= SERVICE_LIMIT_BY_PLAN.Dominant
                    ? 'You have reached the service limit for this plan.'
                    : 'You have reached your plan\'s service limit (' + SERVICE_LIMIT + '). Upgrade to list more.';
            }
        } else {
            if (addRow) addRow.style.display = 'flex';
            if (limitHint) limitHint.textContent = '';
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

// ─── EDIT MODE (pre-fill an existing listing for update) ──────────────────

    async function loadListingForEdit(id) {
        const { data, error } = await _supabaseLW
            .from('Workshopprofiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            document.getElementById('searchStep').style.display = 'none';
            document.getElementById('mainContent').innerHTML =
                '<p style="text-align:center; padding:3rem 1rem; color:var(--text-secondary);">' +
                'We could not find that listing, or it does not belong to your account.</p>';
            return;
        }

        editingListingId = data.id;
        populateFormForEdit(data);
        showForm();

        const titleEl = document.getElementById('lwFormTitle');
        const subtitleEl = document.getElementById('lwFormSubtitle');
        const submitBtn = document.getElementById('lwSubmitBtn');
        if (titleEl) titleEl.textContent = 'Edit Your Workshop';
if (subtitleEl) subtitleEl.textContent = 'Update your details below. Changes apply immediately once saved.';
        if (submitBtn) submitBtn.textContent = 'Save Changes for Review';
    }

    function populateFormForEdit(w) {
        document.getElementById('lwName').value = w.workshop_name || '';
        document.getElementById('lwAddress').value = w.physical_address || '';
        document.getElementById('lwSuburb').value = w.suburb || '';
        document.getElementById('lwCity').value = w.city || '';
        document.getElementById('lwProvince').value = w.province || '';
        document.getElementById('lwContact').value = w.contact_number || '';
        document.getElementById('lwHours').value = w.operating_hours || '';
        document.getElementById('lwYears').value = w.years_operation || '';

        const specs = (w.specialisation || '').split(',').map(function (s) { return s.trim(); });
        document.querySelectorAll('input[name="lwSpec"]').forEach(function (box) {
            box.checked = specs.includes(box.value);
        });

        const rmiRadio = document.querySelector('input[name="lwRmi"][value="' + (w.rmi_registered || 'No') + '"]');
        if (rmiRadio) rmiRadio.checked = true;

        const quoteRadio = document.querySelector('input[name="lwQuote"][value="' + (w.written_quote || 'No') + '"]');
        if (quoteRadio) quoteRadio.checked = true;

        const guaranteeRadio = document.querySelector('input[name="lwGuarantee"][value="' + (w.guarantee_work || 'No') + '"]');
        if (guaranteeRadio) guaranteeRadio.checked = true;
        if (w.guarantee_work === 'Yes') {
            document.getElementById('lwGuaranteePeriodWrap').classList.remove('hidden');
            document.getElementById('lwGuaranteePeriod').value = w.guarantee_period || '';
        }

addedServices = Array.isArray(w.services) ? w.services.slice() : [];
        SERVICE_LIMIT = SERVICE_LIMIT_BY_PLAN[w.plan] || SERVICE_LIMIT_BY_PLAN.Visible;
        renderServiceCards();

        // Real photos are a paid-plan feature. Free-tier editors see an
        // upgrade note instead of the upload control.
        existingPhotoUrl = w.photo_url || null;
        const photoWrap = document.getElementById('lwPhotoWrap');
        const photoUpsell = document.getElementById('lwPhotoUpsell');
        const isPaidPlan = w.plan && w.plan !== 'Visible';
        if (photoWrap) photoWrap.style.display = isPaidPlan ? 'block' : 'none';
        if (photoUpsell) photoUpsell.style.display = isPaidPlan ? 'none' : 'block';
        if (isPaidPlan && existingPhotoUrl) {
            const previewWrap = document.getElementById('lwPhotoPreviewWrap');
            const preview = document.getElementById('lwPhotoPreview');
            if (previewWrap && preview) {
                preview.src = existingPhotoUrl;
                previewWrap.style.display = 'block';
            }
        }
    }

    // ─── FORM VALIDATION & SUBMISSION ───────────────────────────────────────────

    function collectFormData() {
        const specs = Array.from(document.querySelectorAll('input[name="lwSpec"]:checked')).map(function (el) { return el.value; });
const gp = document.getElementById('lwGuaranteePeriod').value.trim();

        const base = {
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
services: addedServices
        };

        if (!editingListingId) {
            // Only a brand-new signup starts on the free plan and needs
            // admin approval. Editing an existing listing must never touch
            // plan, plan_price, or status — those belong to whatever admin
            // already set, paid or not, and editing your hours shouldn't
            // silently downgrade or unpublish you.
            base.plan = 'Visible';
            base.plan_price = 0;
            base.status = 'Pending';
            base.source = 'Workshop Registered';
        }

        return base;
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
        submitBtn.textContent = editingListingId ? 'Saving…' : 'Submitting…';

        // Only ever reached in edit mode, since the upload field is hidden
        // for new (always-Free) signups. Storage RLS is the real gate on
        // whether this succeeds — a Free-tier workshop's upload is
        // rejected server-side even if this ran.
        if (selectedPhotoFile && editingListingId) {
            const photoErrorEl = document.getElementById('lwPhotoError');
            const uploadedUrl = await uploadWorkshopPhoto(selectedPhotoFile, editingListingId);
            if (uploadedUrl) {
                data.photo_url = uploadedUrl;
            } else if (photoErrorEl) {
                photoErrorEl.textContent = 'Photo upload failed — your other details will still be saved.';
                photoErrorEl.style.display = 'block';
            }
        }

  const referralCode = localStorage.getItem('veriyo_ref') || null;
  const visitorId = localStorage.getItem('veriyo_visitor_id') || null;
  const { data: insertedRow, error } = editingListingId
            ? await _supabaseLW.from('Workshopprofiles').update(data).eq('id', editingListingId).select().single()
            : await _supabaseLW.from('Workshopprofiles').insert(Object.assign({}, data, {
                referral_source: referralCode
            })).select().single();
  
  // If this listing came from a partner link, mark that click as converted
  if (!error && referralCode && visitorId) {
    await _supabaseLW.from('partner_referrals').update({ converted_status: 'Workshop Registration', last_visit_at: new Date().toISOString() }).eq('partner_code', referralCode).eq('visitor_session_id', visitorId);
  }
        if (error) {
            errorEl.textContent = 'Submission failed: ' + error.message + '. Please try again.';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = editingListingId ? 'Save Changes for Review' : 'Submit Listing for Review';
        } else {
            document.getElementById('formStep').style.display = 'none';
            document.getElementById('lw-success-section').style.display = 'block';
            if (editingListingId) {
                document.querySelector('#lw-success-section h3').textContent = 'Changes Submitted!';
                document.querySelector('#lw-success-section p').textContent =
'Your updated details are live. Your plan and listing status were not affected.';
            }
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

const editParam = new URLSearchParams(window.location.search).get('edit');
        if (editParam) {
            loadListingForEdit(editParam);
        } else {
            document.getElementById('searchStep').style.display = 'block';
        }

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

        // Workshop photo upload (Growth/Premium only — field is hidden
        // entirely for Free-tier editors via populateFormForEdit)
        const photoInput = document.getElementById('lwPhotoInput');
        if (photoInput) {
            photoInput.addEventListener('change', function () {
                const errorEl = document.getElementById('lwPhotoError');
                errorEl.style.display = 'none';
                const file = photoInput.files && photoInput.files[0];
                if (!file) return;

                if (file.size > 5 * 1024 * 1024) {
                    errorEl.textContent = 'Photo must be under 5MB.';
                    errorEl.style.display = 'block';
                    photoInput.value = '';
                    return;
                }

                selectedPhotoFile = file;
                const previewWrap = document.getElementById('lwPhotoPreviewWrap');
                const preview = document.getElementById('lwPhotoPreview');
                if (previewWrap && preview) {
                    preview.src = URL.createObjectURL(file);
                    previewWrap.style.display = 'block';
                }
            });
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
