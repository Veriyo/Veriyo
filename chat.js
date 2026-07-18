/**
 * Veriyo | Chat System
 * Motorist ↔ Workshop real-time messaging via Supabase.
 */
(function () {
    const SUPABASE_URL = 'https://xxigkehuqtwaihyxaahk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4aWdrZWh1cXR3YWloeXhhYWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODQzNjQsImV4cCI6MjA5NTM2MDM2NH0.HNLzFWXGZw6jAxl9IHvJ2IOWPSJiC3iKoC1UXmsUQPc';
    const _supabaseChat = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const PHONE_RE = /(\+?(\d[\s\-]?){9,})/;
    const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

    function containsContactDetails(text) {
        return PHONE_RE.test(text) || EMAIL_RE.test(text);
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    }

    function scrollToBottom(threadEl) {
        if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;
    }

function buildBubble(msg, currentUserId, mode) {
        const isMine = (mode === 'workshop' || mode === 'admin')
            ? msg.sender === mode
            : msg.sender === (mode === 'partner' ? 'partner' : 'motorist');
        const side = isMine ? 'right' : 'left';
        return `<div class="chat-bubble chat-bubble--${side}">
            <div class="chat-bubble-text">${escapeHtml(msg.message_text)}</div>
            <div class="chat-bubble-time">${formatTime(msg.created_at)}</div>
        </div>`;
    }

    // ─── MOTORIST VIEW ──────────────────────────────────────────────────────────
    async function initMotoristView(session, workshopId) {
        const view = document.getElementById('chatMotivistView');
        const threadEl = document.getElementById('chatThread');
        const sendBtn = document.getElementById('chatSendBtn');
        const inputEl = document.getElementById('chatInput');
        const sendError = document.getElementById('chatSendError');
        const workshopNameEl = document.getElementById('chatWorkshopName');

        view.style.display = 'block';
        document.getElementById('chatLoading').style.display = 'none';

        // Fetch workshop name
        const { data: workshop } = await _supabaseChat
            .from('Workshopprofiles')
            .select('workshop_name')
            .eq('id', workshopId)
            .single();

        workshopNameEl.textContent = workshop ? workshop.workshop_name : 'Workshop Chat';
        document.title = (workshop ? workshop.workshop_name : 'Workshop') + ' — Chat — Veriyo';

        // Load messages
        async function loadMessages() {
            const { data: msgs } = await _supabaseChat
                .from('chats')
                .select('*')
                .eq('workshop_id', workshopId)
                .eq('motorist_id', session.user.id)
                .order('created_at', { ascending: true });

            threadEl.innerHTML = (msgs || []).map(m => buildBubble(m, session.user.id, 'motorist')).join('');
            scrollToBottom(threadEl);
        }

        await loadMessages();

        // Realtime subscription
        _supabaseChat
            .channel('chats-motorist-' + workshopId + '-' + session.user.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: 'workshop_id=eq.' + workshopId
            }, function (payload) {
                const msg = payload.new;
                if (msg.motorist_id !== session.user.id) return;
                threadEl.innerHTML += buildBubble(msg, session.user.id, 'motorist');
                scrollToBottom(threadEl);
            })
            .subscribe();

        // Send handler
        async function sendMessage() {
            const text = inputEl.value.trim();
            sendError.style.display = 'none';
            if (!text) return;

            if (containsContactDetails(text)) {
                sendError.textContent = 'Contact details cannot be shared in chat.';
                sendError.style.display = 'block';
                return;
            }

            sendBtn.disabled = true;
            const { error } = await _supabaseChat.from('chats').insert({
                workshop_id: workshopId,
                motorist_id: session.user.id,
                sender: 'motorist',
                message_text: text
            });

            sendBtn.disabled = false;
            if (error) {
                sendError.textContent = 'Failed to send message. Please try again.';
                sendError.style.display = 'block';
            } else {
                inputEl.value = '';
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }

    // ─── MOTORIST CONVERSATION LIST ─────────────────────────────────────────────
    async function initMotoristList(session) {
        const view = document.getElementById('chatMotoristListView');
        const listEl = document.getElementById('chatMotoristConvList');
        const emptyEl = document.getElementById('chatMotoristEmpty');

        view.style.display = 'block';
        document.getElementById('chatLoading').style.display = 'none';
        document.title = 'Messages — Veriyo';

        const { data: allMsgs } = await _supabaseChat
            .from('chats')
            .select('*')
            .eq('motorist_id', session.user.id)
            .order('created_at', { ascending: false });

        if (!allMsgs || allMsgs.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }

        // Group by workshop_id, keep the latest message as the preview.
        const byWorkshop = {};
        allMsgs.forEach(function (m) {
            if (!byWorkshop[m.workshop_id]) byWorkshop[m.workshop_id] = m;
        });
        const workshopIds = Object.keys(byWorkshop);

        const { data: workshops } = await _supabaseChat
            .from('Workshopprofiles')
            .select('id, workshop_name')
            .in('id', workshopIds);

        const namesById = {};
        (workshops || []).forEach(function (w) { namesById[w.id] = w.workshop_name; });

        listEl.innerHTML = '';
        workshopIds.forEach(function (workshopId) {
            const latestMsg = byWorkshop[workshopId];
            const name = namesById[workshopId] || 'Workshop';
            const preview = latestMsg.message_text.length > 60
                ? latestMsg.message_text.slice(0, 60) + '…'
                : latestMsg.message_text;
            const convItem = document.createElement('a');
            convItem.href = 'chat.html?workshop_id=' + encodeURIComponent(workshopId);
            convItem.className = 'chat-conv-item';
            convItem.innerHTML = `
                <div class="chat-conv-avatar">${escapeHtml(name[0] || 'W')}</div>
                <div class="chat-conv-info">
                    <div class="chat-conv-id">${escapeHtml(name)}</div>
                    <div class="chat-conv-preview">${escapeHtml(preview)}</div>
                </div>`;
            listEl.appendChild(convItem);
        });
    }

    // ─── WORKSHOP MANAGER VIEW ──────────────────────────────────────────────────
    async function initWorkshopView(session) {
        const view = document.getElementById('chatWorkshopView');
        const convListEl = document.getElementById('chatConvList');
        const convEmpty = document.getElementById('chatConvEmpty');
        const activeThreadPanel = document.getElementById('chatActiveThread');
        const managerThreadEl = document.getElementById('chatManagerThread');
        const managerInput = document.getElementById('chatManagerInput');
        const managerSendBtn = document.getElementById('chatManagerSendBtn');
        const managerSendError = document.getElementById('chatManagerSendError');
        const activeMotristEl = document.getElementById('chatActiveMotrist');
        const subtitleEl = document.getElementById('chatManagerSubtitle');

        view.style.display = 'block';
        document.getElementById('chatLoading').style.display = 'none';
        document.title = 'Workshop Chat — Veriyo';

        // Find this manager's workshop by email
        const { data: workshopArr } = await _supabaseChat
            .from('Workshopprofiles')
            .select('id, workshop_name')
            .eq('email_address', session.user.email)
            .limit(1);

        if (!workshopArr || workshopArr.length === 0) {
            view.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding:3rem 1rem;">No workshop linked to your account.</p>';
            return;
        }

        const myWorkshop = workshopArr[0];
        subtitleEl.textContent = myWorkshop.workshop_name;
        // Mark messages as read now, so the unread badge/dot elsewhere clear
        // as soon as the workshop opens Messages rather than at next login.
localStorage.setItem('veriyo_chat_read_' + myWorkshop.id, new Date().toISOString());
        // Spec 8.10: workshop-home.js's unread badge needs a real "last viewed
        // this chat view" marker — session.user.last_sign_in_at only updates on
        // a fresh login, so it never reflects messages actually read this
        // session. Recording an honest marker here instead.
        localStorage.setItem('veriyo_workshop_chat_last_viewed_' + myWorkshop.id, new Date().toISOString());

        // Load all conversations (grouped by motorist)
        const { data: allMsgs } = await _supabaseChat
            .from('chats')
            .select('*')
            .eq('workshop_id', myWorkshop.id)
            .order('created_at', { ascending: false });

        if (!allMsgs || allMsgs.length === 0) {
            convEmpty.style.display = 'block';
        } else {
            // Group by motorist_id, pick latest message as preview
            const byMotorist = {};
            allMsgs.forEach(function (m) {
                if (!byMotorist[m.motorist_id]) byMotorist[m.motorist_id] = m;
            });
            const motoristIds = Object.keys(byMotorist);

// Spec 8.10: show the motorist's real name in the list, not their id.
            // Uses a safe lookup function instead of querying account_profiles
            // directly — a workshop has no general permission to browse other
            // people's account rows, only this narrow name-only view of them.
            const { data: motoristProfiles } = await _supabaseChat
                .rpc('get_account_display_names', { target_ids: motoristIds });
            const namesById = {};
            (motoristProfiles || []).forEach(function (p) {
                if (p.display_name) namesById[p.user_id] = p.display_name;
            });

            convListEl.innerHTML = '';
            Object.entries(byMotorist).forEach(function ([motoristId, latestMsg]) {
                const displayName = namesById[motoristId] || (motoristId.slice(0, 8) + '…');
                const initial = displayName[0].toUpperCase();
                const preview = latestMsg.message_text.length > 60
                    ? latestMsg.message_text.slice(0, 60) + '…'
                    : latestMsg.message_text;
                const convItem = document.createElement('div');
                convItem.className = 'chat-conv-item';
                convItem.dataset.motoristId = motoristId;
                convItem.innerHTML = `
                    <div class="chat-conv-avatar">${escapeHtml(initial)}</div>
                    <div class="chat-conv-info">
                        <div class="chat-conv-id">${escapeHtml(displayName)}</div>
                        <div class="chat-conv-preview">${escapeHtml(preview)}</div>
                    </div>`;
                convItem.addEventListener('click', function () {
                    document.querySelectorAll('.chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
                    convItem.classList.add('chat-conv-item--active');
                    openThread(motoristId, myWorkshop.id, session, displayName);
                });
                convListEl.appendChild(convItem);
            });
        }

        let currentRealtimeSub = null;

        function openThread(motoristId, workshopId, session, displayName) {
            activeThreadPanel.style.display = 'flex';
            activeMotristEl.textContent = displayName || ('Motorist: ' + motoristId.slice(0, 8) + '…');
            managerSendError.style.display = 'none';

            async function loadThread() {
                const { data: msgs } = await _supabaseChat
                    .from('chats')
                    .select('*')
                    .eq('workshop_id', workshopId)
                    .eq('motorist_id', motoristId)
                    .order('created_at', { ascending: true });

                managerThreadEl.innerHTML = (msgs || []).map(m => buildBubble(m, session.user.id, 'workshop')).join('');
                scrollToBottom(managerThreadEl);
            }

            loadThread();

            // Unsubscribe previous realtime
            if (currentRealtimeSub) {
                _supabaseChat.removeChannel(currentRealtimeSub);
            }

            currentRealtimeSub = _supabaseChat
                .channel('chats-workshop-' + workshopId + '-' + motoristId)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chats',
                    filter: 'workshop_id=eq.' + workshopId
                }, function (payload) {
                    const msg = payload.new;
                    if (msg.motorist_id !== motoristId) return;
                    managerThreadEl.innerHTML += buildBubble(msg, session.user.id, 'workshop');
                    scrollToBottom(managerThreadEl);
                })
                .subscribe();

// Replace old listener by cloning the button, so a previously
            // opened thread's send-handler doesn't fire alongside this one.
            const newSendBtn = managerSendBtn.cloneNode(true);
            managerSendBtn.parentNode.replaceChild(newSendBtn, managerSendBtn);
            const newInput = managerInput.cloneNode(true);
            managerInput.parentNode.replaceChild(newInput, managerInput);

            // Wire send for this thread — reads from newInput/newSendBtn (the
            // boxes actually visible on screen), not the originals, which are
            // detached from the page the moment the clone-swap above runs.
            async function sendReply() {
                const text = newInput.value.trim();
                managerSendError.style.display = 'none';
                if (!text) return;

                if (containsContactDetails(text)) {
                    managerSendError.textContent = 'Contact details cannot be shared in chat.';
                    managerSendError.style.display = 'block';
                    return;
                }

                newSendBtn.disabled = true;
                const { error } = await _supabaseChat.from('chats').insert({
                    workshop_id: workshopId,
                    motorist_id: motoristId,
                    sender: 'workshop',
                    message_text: text
                });

                newSendBtn.disabled = false;
                if (error) {
                    managerSendError.textContent = 'Failed to send. Please try again.';
                    managerSendError.style.display = 'block';
                } else {
                    newInput.value = '';
                }
            }

            newSendBtn.addEventListener('click', sendReply);
            newInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
            });
        }

        document.getElementById('chatCloseThread').addEventListener('click', function () {
            activeThreadPanel.style.display = 'none';
            document.querySelectorAll('.chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
            if (currentRealtimeSub) {
                _supabaseChat.removeChannel(currentRealtimeSub);
                currentRealtimeSub = null;
            }
        });
    }
// ─── ADMIN VIEW (chat with any partner) ─────────────────────────────────────
    async function initAdminView(session) {
        const view = document.getElementById('chatAdminView');
        const convListEl = document.getElementById('chatAdminConvList');
        const convEmpty = document.getElementById('chatAdminConvEmpty');
        const activeThreadPanel = document.getElementById('chatAdminActiveThread');
        const adminThreadEl = document.getElementById('chatAdminThread');
        const adminInput = document.getElementById('chatAdminInput');
        const adminSendBtn = document.getElementById('chatAdminSendBtn');
        const adminSendError = document.getElementById('chatAdminSendError');
        const activePartnerEl = document.getElementById('chatActivePartner');

        view.style.display = 'block';
        document.getElementById('chatLoading').style.display = 'none';
        document.title = 'Partner Chat — Veriyo';

        // Unlike the workshop manager view, this lists every partner — not
        // just ones who already messaged — so admin can start a fresh
        // conversation with anyone, sorted most-recently-active first.
        const { data: partners } = await _supabaseChat
            .from('partners')
            .select('id, full_name, partner_code')
            .order('last_active_at', { ascending: false, nullsFirst: false });

        if (!partners || partners.length === 0) {
            convEmpty.style.display = 'block';
            return;
        }

        const { data: allMsgs } = await _supabaseChat
            .from('chats')
            .select('*')
            .not('partner_id', 'is', null)
            .order('created_at', { ascending: false });

        const latestByPartner = {};
        (allMsgs || []).forEach(function (m) {
            if (!latestByPartner[m.partner_id]) latestByPartner[m.partner_id] = m;
        });

        convListEl.innerHTML = '';
        partners.forEach(function (partner) {
            const latestMsg = latestByPartner[partner.id];
            const displayName = partner.full_name || partner.partner_code;
            const preview = latestMsg
                ? (latestMsg.message_text.length > 60 ? latestMsg.message_text.slice(0, 60) + '…' : latestMsg.message_text)
                : 'No messages yet — tap to start a conversation';
            const convItem = document.createElement('div');
            convItem.className = 'chat-conv-item';
            convItem.dataset.partnerId = partner.id;
            convItem.innerHTML = `
                <div class="chat-conv-avatar">${escapeHtml(displayName[0].toUpperCase())}</div>
                <div class="chat-conv-info">
                    <div class="chat-conv-id">${escapeHtml(displayName)}</div>
                    <div class="chat-conv-preview">${escapeHtml(preview)}</div>
                </div>`;
            convItem.addEventListener('click', function () {
                document.querySelectorAll('#chatAdminConvList .chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
                convItem.classList.add('chat-conv-item--active');
                openPartnerThread(partner.id, displayName);
            });
            convListEl.appendChild(convItem);
        });

        let currentRealtimeSub = null;

        function openPartnerThread(partnerId, displayName) {
            activeThreadPanel.style.display = 'flex';
            activePartnerEl.textContent = displayName;
            adminSendError.style.display = 'none';

            async function loadThread() {
                const { data: msgs } = await _supabaseChat
                    .from('chats')
                    .select('*')
                    .eq('partner_id', partnerId)
                    .order('created_at', { ascending: true });

                adminThreadEl.innerHTML = (msgs || []).map(m => buildBubble(m, session.user.id, 'admin')).join('');
                scrollToBottom(adminThreadEl);
            }

            loadThread();

            if (currentRealtimeSub) {
                _supabaseChat.removeChannel(currentRealtimeSub);
            }

            currentRealtimeSub = _supabaseChat
                .channel('chats-admin-' + partnerId)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chats',
                    filter: 'partner_id=eq.' + partnerId
                }, function (payload) {
                    adminThreadEl.innerHTML += buildBubble(payload.new, session.user.id, 'admin');
                    scrollToBottom(adminThreadEl);
                })
                .subscribe();

            const newSendBtn = adminSendBtn.cloneNode(true);
            adminSendBtn.parentNode.replaceChild(newSendBtn, adminSendBtn);
            const newInput = adminInput.cloneNode(true);
            adminInput.parentNode.replaceChild(newInput, adminInput);

            async function sendReply() {
                const text = newInput.value.trim();
                adminSendError.style.display = 'none';
                if (!text) return;

                newSendBtn.disabled = true;
                const { error } = await _supabaseChat.from('chats').insert({
                    partner_id: partnerId,
                    sender: 'admin',
                    message_text: text
                });

                newSendBtn.disabled = false;
                if (error) {
                    adminSendError.textContent = 'Failed to send. Please try again.';
                    adminSendError.style.display = 'block';
                } else {
                    newInput.value = '';
                }
            }

            newSendBtn.addEventListener('click', sendReply);
            newInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
            });
        }

        document.getElementById('chatAdminCloseThread').addEventListener('click', function () {
            activeThreadPanel.style.display = 'none';
            document.querySelectorAll('#chatAdminConvList .chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
            if (currentRealtimeSub) {
                _supabaseChat.removeChannel(currentRealtimeSub);
                currentRealtimeSub = null;
            }
        });
    }

    // ─── PARTNER VIEW (single thread with Admin) ────────────────────────────────
    async function initPartnerView(session) {
        const view = document.getElementById('chatPartnerView');
        const threadEl = document.getElementById('chatPartnerThread');
        const sendBtn = document.getElementById('chatPartnerSendBtn');
        const inputEl = document.getElementById('chatPartnerInput');
        const sendError = document.getElementById('chatPartnerSendError');

        view.style.display = 'block';
        document.getElementById('chatLoading').style.display = 'none';
        document.title = 'Chat with Admin — Veriyo';

        async function loadMessages() {
            const { data: msgs } = await _supabaseChat
                .from('chats')
                .select('*')
                .eq('partner_id', session.user.id)
                .order('created_at', { ascending: true });

            threadEl.innerHTML = (msgs || []).map(m => buildBubble(m, session.user.id, 'partner')).join('');
            scrollToBottom(threadEl);
        }

        await loadMessages();

        _supabaseChat
            .channel('chats-partner-' + session.user.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: 'partner_id=eq.' + session.user.id
            }, function (payload) {
                threadEl.innerHTML += buildBubble(payload.new, session.user.id, 'partner');
                scrollToBottom(threadEl);
            })
            .subscribe();

        async function sendMessage() {
            const text = inputEl.value.trim();
            sendError.style.display = 'none';
            if (!text) return;

            sendBtn.disabled = true;
            const { error } = await _supabaseChat.from('chats').insert({
                partner_id: session.user.id,
                sender: 'partner',
                message_text: text
            });

            sendBtn.disabled = false;
            if (error) {
                sendError.textContent = 'Failed to send message. Please try again.';
                sendError.style.display = 'block';
            } else {
                inputEl.value = '';
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }

    // ─── ENTRY POINT ────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async function () {
        const { data: { session } } = await _supabaseChat.auth.getSession();

        if (!session) {
            // Save redirect and bounce to auth
            const currentUrl = window.location.pathname.split('/').pop() + window.location.search;
            sessionStorage.setItem('veriyo_chat_redirect', currentUrl);
            document.getElementById('chatLoading').style.display = 'none';
            document.getElementById('chatAuthRequired').style.display = 'block';
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        const workshopId = params.get('workshop_id');

if (mode === 'workshop') {
            await initWorkshopView(session);
        } else if (mode === 'admin') {
            await initAdminView(session);
        } else if (mode === 'partner') {
            await initPartnerView(session);
        } else if (workshopId) {
            await initMotoristView(session, workshopId);
        } else {
            await initMotoristList(session);
        }
    });
})();
