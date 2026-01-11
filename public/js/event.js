// Event System Logic
const API_BASE = '/api/event';

// Helper: Get Token
function getToken() {
    // Try to get token from Telegram WebApp if available, or localStorage
    // In this project, it seems token handling is likely in script.js or implicitly handled.
    // Based on `web.js`, it expects 'Authorization: Bearer <token>'
    // We'll assume one of the global variables or localStorage holds it.
    // Let's assume `window.Telegram.WebApp.initData` is used or we reuse `script.js` auth logic.
    // For now, let's try to find where token is stored.
    // If not found, we might need to prompt user or use the existing `authToken` variable if exposed.
    return localStorage.getItem('aston_session_token') || '';
}

// 1. Check Status & Redirect
async function checkEventStatus(currentPage) {
    try {
        const res = await fetch(`${API_BASE}/participants`); // Reuse this endpoint to get status
        const data = await res.json();

        if (data.status) {
            // Logic:
            // If Closed -> Redirect to 'Closed' page or show alert (unless admin)
            // If Announcement -> Redirect to Winners Page (if not already there)

            if (data.status === 'announcement' && !currentPage.includes('winners')) {
                window.location.href = 'event-winners.html';
                return;
            }

            if (data.status === 'open' && currentPage.includes('winners')) {
                // If mistakenly on winners page but status is open
                window.location.href = 'event-registration.html';
                return;
            }

            // If closed, maybe stay on participants page?
        }
        return data;
    } catch (e) {
        console.error('Status check failed', e);
    }
}

// 2. Submit Registration
async function submitRegistration(formData) {
    const token = getToken();
    if (!token) {
        alert('Authentication failed. Please open from Telegram.');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const result = await res.json();
        if (result.success) {
            // Save to local flag
            localStorage.setItem('event_registered', 'true');
            window.location.href = 'event-participants.html';
        } else {
            alert(result.error || 'Registration failed');
        }
    } catch (e) {
        alert('Error submitting form: ' + e.message);
    }
}

// 3. Load Participants
async function loadParticipants(containerId) {
    try {
        const res = await fetch(`${API_BASE}/participants`);
        const result = await res.json();

        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (result.status === 'announcement' && result.winners) {
            // Let the winners page handle this, or render here if shared
        }

        if (result.participants && result.participants.length > 0) {
            // Helper to censor 2 random chars
            const censorUsername = (username) => {
                if (!username || username.length <= 3) return username; // Too short to censor safely
                let chars = username.split('');
                let indices = [];
                // Find candidates (skip @ and short prefixes if needed)
                for (let i = 1; i < chars.length; i++) { // Skip index 0 (@)
                    indices.push(i);
                }

                // Shuffle indices
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]];
                }

                // Pick first 2 unique indices
                if (indices.length >= 2) {
                    chars[indices[0]] = '*';
                    chars[indices[1]] = '*';
                } else if (indices.length === 1) {
                    chars[indices[0]] = '*';
                }

                return chars.join('');
            };

            // Limit to top 100 or something if huge
            result.participants.forEach(p => {
                const item = document.createElement('div');
                item.className = 'glass-btn';
                item.style.padding = '12px';
                item.style.textAlign = 'center';
                const displayName = censorUsername(p.telegram_username);
                item.innerHTML = `<span class="btn-text" style="color:var(--accent-blue)">${displayName}</span>`;
                container.appendChild(item);
            });

            // Update counter if exists
            const counter = document.getElementById('participant-count');
            if (counter) counter.innerText = `${result.participants.length} Traders Joined`;
        } else {
            container.innerHTML = '<div style="text-align:center;color:white;opacity:0.5;width:100%">Belum ada peserta. Jadilah yang pertama!</div>';
        }
    } catch (e) {
        console.error('Load participants failed', e);
    }
}
