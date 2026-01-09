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
        addAiMessage("Error: No symbol provided.");
        return;
    }

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
});
