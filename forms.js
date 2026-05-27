/**
 * Veriyo | Built for South African drivers
 * Submission Form Processing & Client-Side Interactivity Validations
 */

// Supabase connection
const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_eiHzLsBdrkhJxzFGsGKztQ_xHqvE9K8'
const supabaseDB = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

document.addEventListener('DOMContentLoaded', () => {
    const reportRepairForm = document.getElementById('reportRepairForm')
    const listWorkshopForm = document.getElementById('listWorkshopForm')

    if (reportRepairForm) {
        initRepairReportingModules(reportRepairForm)
    }
    if (listWorkshopForm) {
        initWorkshopListingModules(listWorkshopForm)
    }
})

function initRepairReportingModules(formNode) {
    const characterTextArea = document.getElementById('additionalNotes')
    const counterDisplay = document.getElementById('charCount')
    const structuralReceiptToggle = document.getElementsByName('keptReceipt')
    const wrapperReceiptUpload = document.getElementById('receiptUploadContainer')
    const dynamicStarSpans = document.querySelectorAll('.star-rating-picker span')
    const internalRatingStorage = document.getElementById('overallRatingValue')

    if (characterTextArea && counterDisplay) {
        characterTextArea.addEventListener('input', () => {
            const dynamicLength = characterTextArea.value.length
            counterDisplay.textContent = `${dynamicLength} / 500 characters`
        })
    }

    structuralReceiptToggle.forEach(radioElement => {
        radioElement.addEventListener('change', (e) => {
            if (e.target.value === 'Yes' && e.target.checked) {
                wrapperReceiptUpload.classList.remove('hidden')
                document.getElementById('receiptImage').setAttribute('required', 'required')
            } else {
                wrapperReceiptUpload.classList.add('hidden')
                document.getElementById('receiptImage').removeAttribute('required')
            }
        })
    })

    dynamicStarSpans.forEach(starNode => {
        starNode.addEventListener('click', () => {
            const weightValue = parseInt(starNode.getAttribute('data-value'), 10)
            internalRatingStorage.value = weightValue

            dynamicStarSpans.forEach(subNode => {
                const stepWeight = parseInt(subNode.getAttribute('data-value'), 10)
                if (stepWeight <= weightValue) {
                    subNode.classList.add('selected')
                    subNode.innerHTML = '&#9733;'
                } else {
                    subNode.classList.remove('selected')
                    subNode.innerHTML = '&#9734;'
                }
            })
        })
    })

    formNode.addEventListener('submit', async (event) => {
        event.preventDefault()

        if (!internalRatingStorage.value || internalRatingStorage.value === "0") {
            alert("Please select a rating before submitting.")
            return
        }

        // Collect all form values
        const submission = {
            workshop_name: document.getElementById('workshopName').value.trim(),
            suburb: document.getElementById('workshopSuburb').value.trim(),
            city: document.getElementById('workshopCity').value.trim(),
            car_brand: document.getElementById('carMake').value,
            car_model: document.getElementById('carModel').value.trim(),
            car_year: parseInt(document.getElementById('carYear').value, 10),
            repair_type: document.getElementById('repairType').value,
            part_description: document.getElementById('partDescription').value.trim(),
            amount_quoted: parseInt(document.getElementById('amountQuoted').value, 10) || 0,
            amount_paid: parseInt(document.getElementById('amountPaid').value, 10),
            price_changed: document.getElementById('priceChanged').value,
            pricing_explained: document.getElementById('pricingExplained').value,
            new_problems: document.getElementById('newProblems').value,
            rating: parseInt(internalRatingStorage.value, 10),
            notes: document.getElementById('additionalNotes').value.trim(),
            firstname: document.getElementById('drawName') ? document.getElementById('drawName').value.trim() : '',
            whatsapp: document.getElementById('drawWhatsapp') ? document.getElementById('drawWhatsapp').value.trim() : '',
            status: 'Pending'
        }

        // Save to Supabase
        const { error } = await supabaseDB
            .from('Submissions')
            .insert([submission])

        if (error) {
            alert('Something went wrong. Please try again.')
            console.error(error)
            return
        }

        // Show thank you message
        const targetContainer = formNode.parentElement
        targetContainer.innerHTML = `
            <div class="thank-you-view">
                <h3>Thank You!</h3>
                <p>Your submission is under review. If approved it will appear on the Prices page within 24 hours.</p>
                <a href="prices.html" class="btn btn-primary">Browse Prices</a>
            </div>
        `
    })
}

function initWorkshopListingModules(formNode) {
    const radioWarrantyToggles = document.getElementsByName('guaranteeWork')
    const blockWarrantyPeriod = document.getElementById('guaranteePeriodContainer')

    radioWarrantyToggles.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.value === 'Yes' && event.target.checked) {
                blockWarrantyPeriod.classList.remove('hidden')
                document.getElementById('guaranteePeriod').setAttribute('required', 'required')
            } else {
                blockWarrantyPeriod.classList.add('hidden')
                document.getElementById('guaranteePeriod').removeAttribute('required')
            }
        })
    })

    formNode.addEventListener('submit', async (event) => {
        event.preventDefault()

        const listing = {
            workshop_name: document.getElementById('workshopName').value.trim(),
            suburb: document.getElementById('suburb').value.trim(),
            city: document.getElementById('city').value.trim(),
            status: 'Pending'
        }

        const { error } = await supabase
            .from('Submissions')
            .insert([listing])

        if (error) {
            alert('Something went wrong. Please try again.')
            return
        }

        const destinationWrapper = formNode.parentElement
        destinationWrapper.innerHTML = `
            <div class="thank-you-view">
                <h3>Listing Received</h3>
                <p>We will review your workshop and get back to you within 48 hours.</p>
                <a href="index.html" class="btn btn-secondary">Return to Homepage</a>
            </div>
        `
    })
}
