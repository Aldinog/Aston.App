document.addEventListener('DOMContentLoaded', async () => {
    // Theme Init
    if (window.themeEngine) window.themeEngine.applyTheme('default');

    // Telegram Init
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
            window.history.back();
        });
    }

    // Elements
    const container = document.getElementById('chat-container');

    // Parse URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode'); // 'analysis' | 'signal' | 'proxy'
    let symbol = urlParams.get('symbol');

    if (!symbol && mode !== 'review_detail') {
        const hasSymbol = false; // Just open empty chat or saved tab
    }

    // --- TAB LOGIC ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const chatContainer = document.getElementById('chat-container');
    const savedContainer = document.getElementById('saved-container');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Toggle
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.dataset.tab;
            if (target === 'chat') {
                chatContainer.style.display = 'flex';
                savedContainer.style.display = 'none';
            } else {
                chatContainer.style.display = 'none';
                savedContainer.style.display = 'flex';
                fetchSavedAnalyses();
            }
        });
    });

    // Last content for saving
    let lastAiContent = null;
    let lastActionType = mode || 'analysis';

    // Auto-Normalize Symbol (BUVA -> BUVA.JK)
    // Assumes IDX context primarily.
    if (symbol && !symbol.includes('.') && /^[A-Z]{4}$/.test(symbol)) {
        symbol = `${symbol}.JK`;
    }

    // Initial Interaction
    if (mode === 'analysis') {
        addUserMessage(`Tolong berikan Analisa untuk saham ${symbol.replace('.JK', '')}`);
        await processAction('analysis', symbol, "Sedang menganalisa data fundamental & teknikal...");
    } else if (mode === 'signal') {
        addUserMessage(`Cek Signal Trading untuk ${symbol.replace('.JK', '')}`);
        await processAction('signal', symbol, "Sedang memindai indikator teknikal...");
    } else if (mode === 'proxy') {
        addUserMessage(`Cek Bandarmology ${symbol.replace('.JK', '')}`);
        await processAction('proxy', symbol, "Sedang melacak aliran dana bandar...");
    } else if (mode === 'review_detail') {
        // NEW: Load from Storage
        const storedResult = localStorage.getItem('temp_review_result');
        if (storedResult) {
            // Display immediately
            const formatted = formatAiResponse(storedResult);
            addAiMessage(formatted);
        } else {
            addAiMessage("⚠️ Data review tidak ditemukan. Silakan lakukan review ulang.");
        }
    } else {
        addAiMessage("Mode tidak dikenali.");
    }

    // --- Core Functions ---

    function addUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message user';
        msgDiv.innerHTML = `<div class="msg-bubble">${text}</div>`;
        container.appendChild(msgDiv);
        scrollToBottom();
    }

    function addAiMessage(htmlContent) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ai';
        msgDiv.innerHTML = `<div class="msg-bubble">${htmlContent}</div>`;
        container.appendChild(msgDiv);
        scrollToBottom();

        // Haptic Feedback
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }

    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai typing-wrapper';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        container.appendChild(typingDiv);
        scrollToBottom();
    }

    function hideTyping() {
        const el = document.getElementById('typing-indicator');
        if (el) el.remove();
    }

    function scrollToBottom() {
        container.scrollTop = container.scrollHeight;
    }

    async function processAction(action, symbol, loadingText) {
        showTyping();

        // Fake delay for "Thinking" feel (min 1.5s)
        const delayPromise = new Promise(r => setTimeout(r, 1500));

        try {
            const token = localStorage.getItem('aston_session_token');
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: action, symbol: symbol })
            });

            await delayPromise; // Ensure user sees typing animation
            hideTyping();

            if (!response.ok) {
                // Try to parse error message from JSON
                try {
                    const errRes = await response.json();
                    if (errRes.error) throw new Error(errRes.error);
                } catch (jsonErr) {
                    // If parsing fails or no error field, stick to generic
                    if (jsonErr.message !== "Server Error") throw jsonErr; // Re-throw if it's the specific error
                }
                throw new Error("Gagal memproses permintaan (Server Error).");
            }

            const res = await response.json();

            // Handle different output formats
            if (res.success && res.data) {
                // Formatting Text
                // 1. Convert newlines to <br>
                // 2. Bold markers **text** to <b>text</b>

                let rawText = "";

                if (typeof res.data === 'string') {
                    rawText = res.data;
                } else if (res.text) {
                    rawText = res.text; // Some endpoints return { success, text }
                } else {
                    // Fallback for object returns (like proxy/fundamentals)
                    rawText = `<pre style="white-space:pre-wrap; font-family:inherit;">${JSON.stringify(res.data, null, 2)}</pre>`;
                }

                const formatted = formatAiResponse(rawText);
                addAiMessage(formatted);

                // Save last content state
                lastAiContent = rawText; // Save RAW for storage
                lastActionType = action;

                // Trigger Save Prompt
                setTimeout(() => showSavePrompt(), 800);

            } else {
                addAiMessage(`❌ Maaf, gagal mengambil data ${action} untuk ${symbol}.`);
            }

        } catch (e) {
            hideTyping();
            console.error(e);
            addAiMessage(`⚠️ ${e.message}`);
        }
    }

    function formatAiResponse(text) {
        if (!text) return "";
        let clean = text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<u>$1</u>');

        return clean;
    }

    // --- SAVE FEATURE FUNCTIONS ---

    function showSavePrompt() {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'message ai';
        promptDiv.id = 'save-prompt-bubble';
        promptDiv.innerHTML = `
            <div class="msg-bubble" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3);">
                <div style="margin-bottom:10px; font-size:0.9rem;">Apakah anda ingin menyimpan analisa ini?</div>
                <div style="display:flex; gap:10px;">
                    <button id="btn-save-yes" style="flex:1; padding:6px; border-radius:6px; background:#10b981; color:white; border:none; cursor:pointer;">Ya</button>
                    <button id="btn-save-no" style="flex:1; padding:6px; border-radius:6px; background:rgba(255,255,255,0.1); color:#cbd5e1; border:none; cursor:pointer;">Tidak</button>
                </div>
            </div>
        `;
        container.appendChild(promptDiv);
        scrollToBottom();

        document.getElementById('btn-save-yes').onclick = async () => {
            promptDiv.remove();
            await saveAnalysis();
        };

        document.getElementById('btn-save-no').onclick = () => {
            promptDiv.remove();
        };
    }

    async function saveAnalysis() {
        if (!lastAiContent) return;

        try {
            const token = localStorage.getItem('aston_session_token');
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    action: 'save_analysis',
                    symbol: symbol ? symbol.replace('.JK', '') : 'GENERAL',
                    type: lastActionType,
                    content: lastAiContent
                })
            });

            const res = await response.json();
            if (res.success) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

                // Show Popup / Toast
                const toast = document.createElement('div');
                toast.style.cssText = `
                    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                    background: rgba(16, 185, 129, 0.9); color: white; padding: 10px 20px;
                    border-radius: 20px; font-size: 0.9rem; z-index: 100; backdrop-filter: blur(4px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: fadeIn 0.3s;
                 `;
                toast.innerHTML = `<i class="fas fa-check-circle"></i> Analisa tersimpan! Cek tab Saved.`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            } else {
                alert('Gagal menyimpan: ' + res.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error saving analysis');
        }
    }

    async function fetchSavedAnalyses() {
        const savedContainer = document.getElementById('saved-container');
        savedContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>';

        try {
            const token = localStorage.getItem('aston_session_token');
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'get_saved' })
            });

            const res = await response.json();
            if (res.success) {
                renderSavedList(res.data);
            } else {
                savedContainer.innerHTML = `<div style="text-align:center; color:#ef4444;">Error: ${res.error}</div>`;
            }
        } catch (e) {
            console.error(e);
            savedContainer.innerHTML = '<div style="text-align:center; color:#ef4444;">Connection Error</div>';
        }
    }

    function renderSavedList(list) {
        const savedContainer = document.getElementById('saved-container');
        if (!list || list.length === 0) {
            savedContainer.innerHTML = `
                <div style="text-align:center; margin-top:50px; color:#64748b;">
                    <i class="fas fa-bookmark" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>Belum ada analisa tersimpan.</p>
                </div>`;
            return;
        }

        savedContainer.innerHTML = ''; // Clear loading
        list.forEach(item => {
            const el = document.createElement('div');
            el.className = 'saved-item';

            // Format Date
            const date = new Date(item.created_at);
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

            el.innerHTML = `
                <div class="saved-header">
                    <div class="saved-title">
                        ${item.symbol} 
                        <span class="saved-badge">${item.type}</span>
                    </div>
                    <div class="saved-time">${dateStr} • ${timeStr}</div>
                </div>
                <div style="font-size:0.85rem; color:#cbd5e1; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    ${item.content.replace(/<[^>]*>?/gm, '').slice(0, 100)}...
                </div>
                <div class="saved-actions">
                    <button class="action-btn btn-view" onclick="viewSavedDetail('${item.id}')">
                        <i class="fas fa-eye"></i> Lihat
                    </button>
                    <button class="action-btn btn-delete" onclick="deleteSavedItem('${item.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            savedContainer.appendChild(el);
        });

        // Expose functions globally for onclick handlers
        window.viewSavedDetail = (id) => {
            const item = list.find(i => i.id === id);
            if (!item) return;

            // Reuse Chat View for Detail but locked
            // Switch back to chat tab visually but clear it first? No, maybe modal is better.
            // Or overwrite Chat Container temporarily?
            // Let's use a simplified approach: Overwrite Chat Container content with a "Back to Saved" button

            const chatContainer = document.getElementById('chat-container');
            const savedContainer = document.getElementById('saved-container');

            chatContainer.innerHTML = ''; // Clear current chat

            // Add Back Button Header override
            const detailHeader = document.createElement('div');
            detailHeader.style.cssText = 'padding:10px; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; gap:10px; cursor:pointer; color:#94a3b8; font-size:0.9rem;';
            detailHeader.innerHTML = `<i class="fas fa-arrow-left"></i> Kembali ke List`;
            detailHeader.onclick = () => {
                document.querySelector('[data-tab="saved"]').click(); // Trigger click to reload/reshow saved
            };

            chatContainer.appendChild(detailHeader);

            // Add Content
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ai';
            msgDiv.style.width = '100%';
            msgDiv.innerHTML = `<div class="msg-bubble">${formatAiResponse(item.content)}</div>`;
            chatContainer.appendChild(msgDiv);

            // Switch Tab UI manually to 'Chat' (as view port) but keep 'Saved' active? 
            // Better: Switch to Chat Tab but treat it as Detail View
            document.querySelector('[data-tab="chat"]').click();
            // Override the btn click logic slightly? No, standard logic hides savedContainer. 
            // We just repopulated chatContainer.
        };

        window.deleteSavedItem = async (id) => {
            if (!confirm('Hapus item ini?')) return;

            try {
                const token = localStorage.getItem('aston_session_token');
                await fetch('/api/web', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ action: 'delete_saved', id: id })
                });
                fetchSavedAnalyses(); // Reload
            } catch (e) { alert('Gagal menghapus'); }
        };
    }
});
