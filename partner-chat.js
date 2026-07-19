/**
 * Veriyo | Admin ↔ Partner Chat
 *
 * Same `chats` table and the same rules as chat.js's motorist/workshop
 * chat (chats.partner_id stores the partner's auth uid, sender is
 * 'admin' or 'partner', contact details are blocked, and a message
 * starting with "📌 Support Request:" renders as a divider instead of
 * a bubble — this last part must match partner.js's handleSupportRequest,
 * which drops that exact marker into this same table).
 *
 * Embedded directly into admin.html's "Partner Chat" tab and partner.html's
 * "Chat" tab, so it reuses the host page's own supabaseClient instead of
 * opening a separate connection, and never navigates away — the partner's
 * (or admin's) own tabs and dashboard stay on screen the whole time.
 */

const PC_PHONE_RE = /(\+?(\d[\s\-]?){9,})/;
const PC_EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function pcContainsContactDetails(text) {
    return PC_PHONE_RE.test(text) || PC_EMAIL_RE.test(text);
}

function pcEscapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pcFormatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

function pcScrollToBottom(threadEl) {
    if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;
}

// Same divider convention as chat.js's buildBubble — a support request
// marker renders as a titled callout instead of a normal bubble.
function pcBuildBubble(msg, mode) {
    if (msg.message_text && msg.message_text.indexOf('📌 Support Request:') === 0) {
        const parts = msg.message_text.split('\n\n');
        const titleLine = parts[0];
        const bodyText = parts.slice(1).join('\n\n');
        return `<div class="chat-thread-divider">
            <div class="chat-thread-divider-title">${pcEscapeHtml(titleLine)}</div>
            ${bodyText ? '<div class="chat-thread-divider-body">' + pcEscapeHtml(bodyText) + '</div>' : ''}
        </div>`;
    }
    const isMine = msg.sender === mode;
    const side = isMine ? 'right' : 'left';
    return `<div class="chat-bubble chat-bubble--${side}">
        <div class="chat-bubble-text">${pcEscapeHtml(msg.message_text)}</div>
        <div class="chat-bubble-time">${pcFormatTime(msg.created_at)}</div>
    </div>`;
}

// ─── ADMIN TAB (partner conversation list + thread) ─────────────────────────
let pcAdminInitialized = false;
let pcOpenPartnerThread = null; // set once initAdminChatTab has run

async function initAdminChatTab() {
    if (pcAdminInitialized) return;
    pcAdminInitialized = true;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const convListEl = document.getElementById('pcAdminConvList');
    const convEmpty = document.getElementById('pcAdminConvEmpty');
    const activeThreadPanel = document.getElementById('pcAdminActiveThread');
    const adminThreadEl = document.getElementById('pcAdminThread');
    const adminInput = document.getElementById('pcAdminInput');
    const adminSendBtn = document.getElementById('pcAdminSendBtn');
    const adminSendError = document.getElementById('pcAdminSendError');
    const activePartnerEl = document.getElementById('pcActivePartner');

    // partners.id is that table's own row id — chats.partner_id stores the
    // partner's auth uid instead (partners.user_id), same pattern as
    // motorist_id elsewhere.
    const { data: partners } = await supabaseClient
        .from('partners')
        .select('id, user_id, full_name, partner_code')
        .order('last_active_at', { ascending: false, nullsFirst: false });

    if (!partners || partners.length === 0) {
        convEmpty.style.display = 'block';
        return;
    }

    const { data: allMsgs } = await supabaseClient
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
        const latestMsg = latestByPartner[partner.user_id];
        const displayName = partner.full_name || partner.partner_code;
        const preview = latestMsg
            ? (latestMsg.message_text.length > 60 ? latestMsg.message_text.slice(0, 60) + '…' : latestMsg.message_text)
            : 'No messages yet — tap to start a conversation';
        const convItem = document.createElement('div');
        convItem.className = 'chat-conv-item';
        convItem.dataset.partnerId = partner.user_id;
        convItem.innerHTML = `
            <div class="chat-conv-avatar">${pcEscapeHtml(displayName[0].toUpperCase())}</div>
            <div class="chat-conv-info">
                <div class="chat-conv-id">${pcEscapeHtml(displayName)}</div>
                <div class="chat-conv-preview">${pcEscapeHtml(preview)}</div>
            </div>`;
        convItem.addEventListener('click', function () {
            document.querySelectorAll('#pcAdminConvList .chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
            convItem.classList.add('chat-conv-item--active');
            openThread(partner.user_id, displayName);
        });
        convListEl.appendChild(convItem);
    });

    let currentRealtimeSub = null;

    function openThread(partnerUserId, displayName) {
        activeThreadPanel.style.display = 'flex';
        activePartnerEl.textContent = displayName;
        adminSendError.style.display = 'none';

        async function loadThread() {
            const { data: msgs } = await supabaseClient
                .from('chats')
                .select('*')
                .eq('partner_id', partnerUserId)
                .order('created_at', { ascending: true });

            adminThreadEl.innerHTML = (msgs || []).map(m => pcBuildBubble(m, 'admin')).join('');
            pcScrollToBottom(adminThreadEl);
        }

        loadThread();

        if (currentRealtimeSub) {
            supabaseClient.removeChannel(currentRealtimeSub);
        }

        currentRealtimeSub = supabaseClient
            .channel('chats-admin-' + partnerUserId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: 'partner_id=eq.' + partnerUserId
            }, function (payload) {
                adminThreadEl.innerHTML += pcBuildBubble(payload.new, 'admin');
                pcScrollToBottom(adminThreadEl);
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

            if (pcContainsContactDetails(text)) {
                adminSendError.textContent = 'Contact details cannot be shared in chat.';
                adminSendError.style.display = 'block';
                return;
            }

            newSendBtn.disabled = true;
            const { error } = await supabaseClient.from('chats').insert({
                partner_id: partnerUserId,
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

    document.getElementById('pcAdminCloseThread').addEventListener('click', function () {
        activeThreadPanel.style.display = 'none';
        document.querySelectorAll('#pcAdminConvList .chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
        if (currentRealtimeSub) {
            supabaseClient.removeChannel(currentRealtimeSub);
            currentRealtimeSub = null;
        }
    });

    // Exposed so the Support Requests tab's "Open Conversation" button can
    // jump straight into a partner's thread without leaving the page.
    pcOpenPartnerThread = function (partnerUserId, displayName) {
        const item = convListEl.querySelector('[data-partner-id="' + partnerUserId + '"]');
        if (item) {
            document.querySelectorAll('#pcAdminConvList .chat-conv-item').forEach(el => el.classList.remove('chat-conv-item--active'));
            item.classList.add('chat-conv-item--active');
        }
        openThread(partnerUserId, displayName);
    };
}

// Called from the Support Requests tab. Safe to call before the chat tab
// has ever been opened — it initializes it first if needed.
async function openPartnerChatThread(partnerUserId, displayName) {
    if (!pcAdminInitialized) await initAdminChatTab();
    if (pcOpenPartnerThread) pcOpenPartnerThread(partnerUserId, displayName);
}

// ─── PARTNER TAB (single thread with admin) ─────────────────────────────────
let pcPartnerInitialized = false;

async function initPartnerChatTab() {
    if (pcPartnerInitialized) return;
    pcPartnerInitialized = true;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const threadEl = document.getElementById('pcPartnerThread');
    const sendBtn = document.getElementById('pcPartnerSendBtn');
    const inputEl = document.getElementById('pcPartnerInput');
    const sendError = document.getElementById('pcPartnerSendError');
    const emptyEl = document.getElementById('pcPartnerEmpty');

    async function loadMessages() {
        const { data: msgs } = await supabaseClient
            .from('chats')
            .select('*')
            .eq('partner_id', session.user.id)
            .order('created_at', { ascending: true });

        if (!msgs || msgs.length === 0) {
            emptyEl.style.display = 'block';
            threadEl.style.display = 'none';
        } else {
            emptyEl.style.display = 'none';
            threadEl.style.display = 'block';
            threadEl.innerHTML = msgs.map(m => pcBuildBubble(m, 'partner')).join('');
            pcScrollToBottom(threadEl);
        }
    }

    await loadMessages();

    supabaseClient
        .channel('chats-partner-' + session.user.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chats',
            filter: 'partner_id=eq.' + session.user.id
        }, function (payload) {
            emptyEl.style.display = 'none';
            threadEl.style.display = 'block';
            threadEl.innerHTML += pcBuildBubble(payload.new, 'partner');
            pcScrollToBottom(threadEl);
        })
        .subscribe();

    async function sendMessage() {
        const text = inputEl.value.trim();
        sendError.style.display = 'none';
        if (!text) return;

        if (pcContainsContactDetails(text)) {
            sendError.textContent = 'Contact details cannot be shared in chat.';
            sendError.style.display = 'block';
            return;
        }

        sendBtn.disabled = true;
        const { error } = await supabaseClient.from('chats').insert({
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
