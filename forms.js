/**
 * Veriyo | Built for South African drivers
 * Submission Form Processing & Client-Side Interactivity Validations
 */
const supabaseUrl = 'https://xxigkehuqtwaihyxaahk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc'
const _supabase = supabase.createClient(supabaseUrl, supabaseKey)

// Capture referral source from URL parameter and store for submission
const _refParam = new URLSearchParams(window.location.search).get('ref');
if (_refParam) localStorage.setItem('veriyo_ref', _refParam);

document.addEventListener('DOMContentLoaded', () => {
    const reportRepairForm = document.getElementById('reportRepairForm');
    const listWorkshopForm = document.getElementById('listWorkshopForm');

    if (reportRepairForm) {
        initRepairReportingModules(reportRepairForm);
    }
    if (listWorkshopForm) {
        initWorkshopListingModules(listWorkshopForm);
    }
});

/**
 * Orchestrates behaviors specific to the Driver Submission module
 */
function initRepairReportingModules(formNode) {
    const characterTextArea = document.getElementById('additionalNotes');
    const counterDisplay = document.getElementById('charCount');
    const structuralReceiptToggle = document.getElementsByName('keptReceipt');
    const wrapperReceiptUpload = document.getElementById('receiptUploadContainer');
    const dynamicStarSpans = document.querySelectorAll('.star-rating-picker span');
    const internalRatingStorage = document.getElementById('overallRatingValue');
// Toggle the submit button state dynamically based on user privacy consent agreement
    const privacyCheckbox = document.getElementById('privacyConsent');
   const submitBtnElement = document.getElementById('submitReportBtn');
    const privacyErrorMsg = document.getElementById('privacyErrorMsg');

    if (privacyCheckbox && submitBtnElement) {
        // Force the button into a disabled visual state on page load
        submitBtnElement.disabled = true;

        privacyCheckbox.addEventListener('change', () => {
            if (privacyCheckbox.checked) {
                // User checked the box: Hide error and restore functionality
                if(privacyErrorMsg) privacyErrorMsg.style.display = 'none';
                submitBtnElement.disabled = false;
            } else {
                // User unchecked the box: Revert back to disabled state
                submitBtnElement.disabled = true;
            }
        });
    }
    // Live textarea character tracking routines
    if (characterTextArea && counterDisplay) {
        characterTextArea.addEventListener('input', () => {
            const dynamicLength = characterTextArea.value.length;
            counterDisplay.textContent = `${dynamicLength} / 500 characters`;
        });
    }
// Conditional reveal: felt overcharged reason textarea
    document.querySelectorAll('input[name="feltOvercharged"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const container = document.getElementById('feltOverchargedReasonContainer');
            if (container) {
                container.classList.toggle('hidden', radio.value !== 'true' || !radio.checked);
            }
        });
    });

    // Conditional reveal: staff treatment reason textarea
    document.querySelectorAll('input[name="staffTreatment"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const container = document.getElementById('staffTreatmentReasonContainer');
            if (container) container.classList.remove('hidden');
        });
    });

    // Toggle logic evaluating radio states to show upload field
    structuralReceiptToggle.forEach(radioElement => {
        radioElement.addEventListener('change', (e) => {
            if (e.target.value === 'Yes' && e.target.checked) {
                wrapperReceiptUpload.classList.remove('hidden');
                document.getElementById('receiptImage').setAttribute('required', 'required');
            } else {
                wrapperReceiptUpload.classList.add('hidden');
                document.getElementById('receiptImage').removeAttribute('required');
            }
        });
    });

    // Rating selector interaction loops
    dynamicStarSpans.forEach(starNode => {
        starNode.addEventListener('click', () => {
            const weightValue = parseInt(starNode.getAttribute('data-value'), 10);
            internalRatingStorage.value = weightValue;
            
            dynamicStarSpans.forEach(subNode => {
                const stepWeight = parseInt(subNode.getAttribute('data-value'), 10);
                if (stepWeight <= weightValue) {
                    subNode.classList.add('selected');
                    subNode.innerHTML = '&#9733;';
                } else {
                    subNode.classList.remove('selected');
                    subNode.innerHTML = '&#9734;';
                }
            });
        });
    });

    // Dynamic Execution interception on form submission
    formNode.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (!privacyCheckbox.checked) {
            // Show red error text. Button stays dark natively.
            if (privacyErrorMsg) privacyErrorMsg.style.display = 'block';
            return; // Halt submission completely
        }

        submitBtnElement.disabled = true;
submitBtnElement.textContent = 'Submitting...';
        
        // Enforce Rating Verification check prior to allowing dispatch pipeline
        if (!internalRatingStorage.value || internalRatingStorage.value === "0") {
            alert("Please select a structural rating star score before submitting.");
            submitBtnElement.disabled = false;
            submitBtnElement.textContent = 'Submit My Experience';
            return;
        }

        const dupCheck = await _supabase
            .from('Submissions')
            .select('id')
            .eq('workshop_name', document.getElementById('workshopName')?.value.trim() || '')
            .eq('repair_type', document.getElementById('repairType')?.value || '')
            .eq('repair_date', document.getElementById('repairDate')?.value || '');

        if (dupCheck.data && dupCheck.data.length > 0) {
            if (!confirm('A submission for this workshop, repair type, and date already exists. Submit anyway?')) {
                submitBtnElement.disabled = false;
                submitBtnElement.textContent = 'Submit My Experience';
                return;
            }
        }

const feltOverchargedRadio = document.querySelector('input[name="feltOvercharged"]:checked');
        const staffTreatmentRadio = document.querySelector('input[name="staffTreatment"]:checked');

        const submission = {
            workshop_name: document.getElementById('workshopName')?.value.trim() || '',
            suburb: document.getElementById('suburb')?.value.trim() || '',
            city: document.getElementById('city')?.value.trim() || '',
            province: document.getElementById('province')?.value || '',
            car_make: document.getElementById('carMake')?.value || '',
            car_model: document.getElementById('carModel')?.value.trim() || '',
            car_year: parseInt(document.getElementById('carYear')?.value, 10) || null,
            repair_date: document.getElementById('repairDate')?.value || null,
            repair_type: document.getElementById('repairType')?.value || '',
            part_description: document.getElementById('partDescription')?.value.trim() || '',
            amount_paid: parseInt(document.getElementById('amountPaid')?.value, 10) || 0,
            rating: parseInt(internalRatingStorage.value, 10),
            notes: document.getElementById('additionalNotes')?.value.trim() || '',
felt_overcharged: feltOverchargedRadio ? (feltOverchargedRadio.value === 'true') : null,
            felt_overcharged_reason: document.getElementById('feltOverchargedReason')?.value.trim() || null,
            staff_treatment: staffTreatmentRadio ? staffTreatmentRadio.value : null,
            staff_treatment_reason: document.getElementById('staffTreatmentReason')?.value.trim() || null,
referral_source: localStorage.getItem('veriyo_ref') || null,
            status: 'Pending'
        };
const { data, error } = await _supabase
            .from('Submissions')
            .insert([submission]);

        if (error) {
            console.error("Supabase Error:", error.message);
            return;
        }

        // Standard client-side HTML5 constraints verified, transition UI container state
        const targetContainer = formNode.parentElement;
        targetContainer.innerHTML = `
            <div class="thank-you-view">
  <div class="icon-success">&#10003;</div>
                <h3>Thank You!</h3>
               <p>Your submission is under operational review by our audit team. If approved, it will appear on the approved Prices dashboard page within 24 hours.</p>
                <a href="prices.html" class="btn btn-primary">Go to Browse Prices</a>
            </div>
        `;
    });
}

/**
 * Orchestrates behaviors specific to the Workshop Profile setup workflow
 */
function initWorkshopListingModules(formNode) {
    const radioWarrantyToggles = document.getElementsByName('guaranteeWork');
    const blockWarrantyPeriod = document.getElementById('guaranteePeriodContainer');

    // Evaluate structural changes on dynamic operational input requirements
    radioWarrantyToggles.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.value === 'Yes' && event.target.checked) {
                blockWarrantyPeriod.classList.remove('hidden');
                document.getElementById('guaranteePeriod').setAttribute('required', 'required');
            } else {
                blockWarrantyPeriod.classList.add('hidden');
                document.getElementById('guaranteePeriod').removeAttribute('required');
            }
        });
    });
// Toggle the submit button state dynamically based on user privacy consent
    const privacyCheckbox = document.getElementById('privacyConsentWorkshop');
const submitBtnElement = document.getElementById('submitWorkshopBtn');
    const privacyErrorMsg = document.getElementById('privacyErrorMsgWorkshop');

    if (privacyCheckbox && submitBtnElement) {
        submitBtnElement.disabled = true;

        privacyCheckbox.addEventListener('change', () => {
            if (privacyCheckbox.checked) {
                if(privacyErrorMsg) privacyErrorMsg.style.display = 'none';
                submitBtnElement.disabled = false;
            } else {
                submitBtnElement.disabled = true;
            }
        });
    }

    // Capture submit pipelines and output direct verification responses
    formNode.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (privacyCheckbox && !privacyCheckbox.checked) {
            if (privacyErrorMsg) privacyErrorMsg.style.display = 'block';
            return;
        }

        submitBtnElement.disabled = true;
        submitBtnElement.textContent = 'Submitting...';

        const submission = {
            workshop_name: document.getElementById('workshopName')?.value.trim() || '',
            physical_address: document.getElementById('physicalAddress')?.value.trim() || '',
            suburb: document.getElementById('workshopSuburb')?.value.trim() || '',
            city: document.getElementById('workshopCity')?.value.trim() || '',
            province: (document.getElementById('province')?.value || '').toLowerCase(),
            contact_number: document.getElementById('contactNumber')?.value.trim() || '',
            email_address: document.getElementById('emailAddress')?.value.trim() || '',
            operating_hours: document.getElementById('operatingHours')?.value.trim() || '',
            specialisation: Array.from(document.querySelectorAll('input[name="specialisation"]:checked')).map(cb => cb.value).join(', '),
            years_operation: parseInt(document.getElementById('yearsOperation')?.value, 10) || 0,
            rmi_registered: document.querySelector('input[name="rmiRegistered"]:checked')?.value || 'No',
            written_quote: document.querySelector('input[name="writtenQuote"]:checked')?.value || 'No',
            guarantee_work: document.querySelector('input[name="guaranteeWork"]:checked')?.value || 'No',
            guarantee_period: document.getElementById('guaranteePeriod')?.value.trim() || '',
            price_oil_change: parseInt(document.getElementById('priceOilChange')?.value, 10) || 0,
            price_minor_service: parseInt(document.getElementById('priceMinorService')?.value, 10) || 0,
            price_major_service: parseInt(document.getElementById('priceMajorService')?.value, 10) || 0,
            price_alignment: parseInt(document.getElementById('priceAlignment')?.value, 10) || 0,
            price_brake_pads: parseInt(document.getElementById('priceBrakePads')?.value, 10) || 0,
            price_diagnostic: parseInt(document.getElementById('priceDiagnostic')?.value, 10) || 0,
            custom_service_name_1: document.getElementById('customServiceName1')?.value.trim() || '',
            custom_service_price_1: parseInt(document.getElementById('customServicePrice1')?.value, 10) || 0,
            custom_service_name_2: document.getElementById('customServiceName2')?.value.trim() || '',
            custom_service_price_2: parseInt(document.getElementById('customServicePrice2')?.value, 10) || 0,
            status: 'Pending'
        };
const { data, error } = await _supabase
            .from('Submissions')
            .insert([submission]);

        if (error) {
            console.error("Supabase Error:", error.message);
        alert("Submission failed to save: " + error.message);
        return; // Exits the function completely. The thank-you screen will NOT show.
    }

    // 4. Success Execution: This ONLY runs if Supabase accepts the data above
    const destinationWrapper = formNode.parentElement;
    destinationWrapper.innerHTML = `
        <div class="thank-you-view">
      <div class="icon-success">&#10003;</div>
            <h3>Registration Logged</h3>
            <p>Thank you for listing your operational profile. We will manually review your credentials and get back to your administration branch within 48 hours.</p>
            <a href="index.html" class="btn btn-primary">Return to Homepage</a>
        </div>
    `;
});
}
