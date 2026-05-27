/**
 * Veriyo | Built for South African drivers
 * Submission Form Processing & Client-Side Interactivity Validations
 */

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

    // Live textarea character tracking routines
    if (characterTextArea && counterDisplay) {
        characterTextArea.addEventListener('input', () => {
            const dynamicLength = characterTextArea.value.length;
            counterDisplay.textContent = `${dynamicLength} / 500 characters`;
        });
    }

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
    formNode.addEventListener('submit', (event) => {
        event.preventDefault();
        
        // Enforce Rating Verification check prior to allowing dispatch pipeline
        if (!internalRatingStorage.value || internalRatingStorage.value === "0") {
            alert("Please select a structural rating star score before submitting.");
            return;
        }

        // Standard client-side HTML5 constraints verified, transition UI container state
        const targetContainer = formNode.parentElement;
        targetContainer.innerHTML = `
            <div class="thank-you-view">
                <div class="icon-success">&#22C5;</div>
                <h3>Thank You!</h3>
                <p>Your submission is under operational review by our audit team. If approved, it will appear on the verified Prices dashboard page within 24 hours.</p>
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

    // Capture submit pipelines and output direct verification responses
    formNode.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const destinationWrapper = formNode.parentElement;
        destinationWrapper.innerHTML = `
            <div class="thank-you-view">
                <div class="icon-success">&#22C5;</div>
                <h3>Registration Logged</h3>
                <p>Thank you for listing your operational profile. We will manually review your credentials and get back to your administration branch within 48 hours.</p>
                <a href="index.html" class="btn btn-secondary">Return to Homepage</a>
            </div>
        `;
    });
}
