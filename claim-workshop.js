/**
 * Veriyo | Claim Workshop
 * Handles workshop claim verification and submission.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseClaim = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let currentWorkshop = null;
    let currentSession = null;

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function uploadFile(file, folder) {
        if (!file) return null;
        const fileName = folder + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const { data, error } = await _supabaseClaim.storage
            .from('claim-evidence')
            .upload(fileName, file);
        if (error) {
            console.error('Upload error:', error);
            return null;
        }
        return _supabaseClaim.storage.from('claim-evidence').getPublicUrl(fileName).data.publicUrl;
    }

    async function loadWorkshop() {
        const params = new URLSearchParams(window.location.search);
        const workshopId = params.get('id');

        if (!workshopId) {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('claimError').style.display = 'block';
            return;
        }

        const { data, error } = await _supabaseClaim
            .from('Workshopprofiles')
            .select('*')
            .eq('id', workshopId)
            .single();

        document.getElementById('loadingState').style.display = 'none';

        if (error || !data) {
            document.getElementById('claimError').style.display = 'block';
            return;
        }

        currentWorkshop = data;

        // Check if already owned
        if (data.user_id) {
            document.getElementById('alreadyOwned').style.display = 'block';
            return;
        }

        // Display workshop info
        document.getElementById('workshopName').textContent = data.workshop_name || 'Unnamed Workshop';
        const location = [data.suburb, data.city, data.province].filter(Boolean).join(', ');
        document.getElementById('workshopLocation').textContent = location || 'Location not specified';

        if (data.source === 'Imported by Veriyo') {
            document.getElementById('workshopSource').textContent = 'This workshop was imported by Veriyo from public records.';
        } else {
            document.getElementById('workshopSource').textContent = 'This workshop was added to our directory.';
        }

        document.getElementById('workshopInfo').style.display = 'block';
    }

    async function submitClaim(e) {
        e.preventDefault();

        const formError = document.getElementById('claimFormError');
        formError.style.display = 'none';

        // Validate
        const contactPerson = document.getElementById('claimContactPerson').value.trim();
        const role = document.getElementById('claimRole').value;
        const phone = document.getElementById('claimPhone').value.trim();
        const signboardFile = document.getElementById('claimSignboard').files[0];
        const interiorFile = document.getElementById('claimInterior').files[0];
        const documentFile = document.getElementById('claimDocument').files[0];
        const notes = document.getElementById('claimNotes').value.trim();
        const consent = document.getElementById('claimConsent');

        if (!contactPerson) {
            formError.textContent = 'Contact person is required.';
            formError.style.display = 'block';
            return;
        }

        if (!phone) {
            formError.textContent = 'Business phone number is required.';
            formError.style.display = 'block';
            return;
        }

        if (!signboardFile) {
            formError.textContent = 'Signboard photo is required.';
            formError.style.display = 'block';
            return;
        }

        if (!consent.checked) {
            document.getElementById('claimConsentError').style.display = 'block';
            return;
        }
        document.getElementById('claimConsentError').style.display = 'none';

        const submitBtn = document.getElementById('claimSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // Upload files
        const signboardUrl = await uploadFile(signboardFile, 'signboards');
        if (!signboardUrl) {
            formError.textContent = 'Failed to upload signboard photo. Please try again.';
            formError.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Claim Request';
            return;
        }

        const interiorUrl = await uploadFile(interiorFile, 'interiors');
        const documentUrl = await uploadFile(documentFile, 'documents');

        // Insert claim request
        const claimData = {
            workshop_id: currentWorkshop.id,
            user_id: currentSession.user.id,
            contact_person: contactPerson,
            role: role || null,
            business_phone: phone,
            signboard_photo_url: signboardUrl,
            interior_photo_url: interiorUrl,
            document_url: documentUrl,
            notes: notes || null,
            status: 'Pending'
        };

        const { error } = await _supabaseClaim
            .from('claim_requests')
            .insert([claimData]);

        if (error) {
            formError.textContent = 'Failed to submit claim: ' + error.message;
            formError.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Claim Request';
            return;
        }

        // Update workshop status to Claim Pending
        await _supabaseClaim
            .from('Workshopprofiles')
            .update({ status: 'Claim Pending' })
            .eq('id', currentWorkshop.id);

        // Show success
        document.getElementById('workshopInfo').style.display = 'none';
        document.getElementById('claimSuccess').style.display = 'block';
    }

    function setupAuthLinks(workshopId) {
        const signInLink = document.getElementById('authSignInLink');
        const signUpLink = document.getElementById('authSignUpLink');

        signInLink.href = 'auth.html?redirect=claim-workshop&workshop_id=' + encodeURIComponent(workshopId);
        signUpLink.href = 'auth.html?redirect=claim-workshop&workshop_id=' + encodeURIComponent(workshopId) + '&signup=1';
    }

    document.addEventListener('DOMContentLoaded', async function () {
        const params = new URLSearchParams(window.location.search);
        const workshopId = params.get('id');

        // Setup auth links first
        setupAuthLinks(workshopId || '');

        // Check session
        const { data: { session } } = await _supabaseClaim.auth.getSession();
        currentSession = session;

        if (!session) {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('authRequired').style.display = 'block';
            return;
        }

        // Load workshop
        await loadWorkshop();

        // Form submit
        const claimForm = document.getElementById('claimForm');
        if (claimForm) {
            claimForm.addEventListener('submit', submitClaim);
        }
    });
})();
