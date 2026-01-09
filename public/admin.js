document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    let sessionToken = localStorage.getItem('aston_session_token');

    const authOverlay = document.getElementById('auth-overlay');
    const authStatus = document.getElementById('auth-status');
    const watchlistBody = document.getElementById('watchlist-body');
    const statusBadge = document.getElementById('app-status-badge');
    const statusText = document.getElementById('status-text');
    const toggleMtBtn = document.getElementById('toggle-mt-btn');

    // Subscription & Search Controls
    const paywallBtn = document.getElementById('toggle-paywall-btn');
    const paywallStatusText = document.getElementById('paywall-status-text');
    const permissionsContainer = document.getElementById('permissions-container');
    const savePermissionsBtn = document.getElementById('save-permissions-btn');
    const userSearchInput = document.getElementById('user-search-input');

    // Maintenance Whitelist Controls
    const whitelistIdInput = document.getElementById('whitelist-id-input');
    const addWhitelistBtn = document.getElementById('add-whitelist-btn');
    const whitelistTagsContainer = document.getElementById('whitelist-tags');

    // Live Mode Whitelist Controls
    const liveWhitelistIdInput = document.getElementById('live-whitelist-id-input');
    const addLiveWhitelistBtn = document.getElementById('add-live-whitelist-btn');
    const liveWhitelistTagsContainer = document.getElementById('live-whitelist-tags');

    // Cooldown Controls [NEW]
    const cooldownBtn = document.getElementById('toggle-cooldown-btn');
    const cooldownStatusText = document.getElementById('cooldown-status-text');
    const cooldownTimer = document.getElementById('cooldown-timer');

    const checkYfBtn = document.getElementById('check-yf-btn');
    const yfStatusText = document.getElementById('yf-status-text');
    const serverIpText = document.getElementById('server-ip-text');

    // Expiry Modal Controls [NEW]
    const expiryModal = document.getElementById('expiry-modal');
    const expiryDateInput = document.getElementById('expiry-date-input');
    const confirmExpiryBtn = document.getElementById('confirm-expiry-btn');
    const cancelExpiryBtn = document.getElementById('cancel-expiry-btn');
    const expiryUserLabel = document.getElementById('expiry-user-label');
    let activeExpiryUserId = null;

    // State Tracker
    let isMaintenanceActive = false;
    let isPaywallActive = false;
    let isCooldownActive = false;
    let currentPermissions = {};
    let allUsers = []; // Cache for searching
    let allWatchlist = []; // Cache for searching [NEW]

    // --- 1. Admin Verification ---
    // --- 1. Admin Verification ---
    const verifyAdmin = async () => {
        if (!sessionToken) {
            window.location.href = 'index.html';
            return;
        }

        // Safety Check for Telegram Environment
        if (!tg || !tg.initData) {
            authStatus.innerHTML = `
                <span style="color:#ef4444">Akses Ditolak: Invalid Environment</span><br>
                <span style="font-size:0.8em; opacity:0.7">Buka melalui Telegram App</span>
            `;
            // Optional: Redirect for safety
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        try {
            // Re-fetch login or a simple verify endpoint to check is_admin
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });

            // Handle non-JSON responses (e.g. 404 HTML from Vercel/Localhost)
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server returned non-JSON response. API might be down.");
            }

            const data = await res.json();

            if (res.ok && data.user && data.user.is_admin) {
                authOverlay.classList.add('hidden');

                // Seasonal Theme (via Engine)
                const activeTheme = data.user.active_theme || 'default';
                if (window.themeEngine) {
                    await window.themeEngine.applyTheme(activeTheme);
                }

                // Update selector to match
                document.getElementById('theme-selector').value = activeTheme;

                updateMTUI(data.user.is_maintenance, data.user.maintenance_end_time);
                loadWatchlist();
                loadUsers();
                loadSubscriptionSettings(data);
                loadMaintenanceWhitelist();
                loadLiveWhitelist();
                loadCooldownSetting();
                loadIPStatus();
            } else {
                authStatus.innerHTML = '<span style="color:#ef4444">Akses Ditolak: Khusus Admin</span>';
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        } catch (err) {
            console.error(err);
            authStatus.innerHTML = `<span style="color:#ef4444">Gagal Verifikasi: ${err.message}</span>`;
        }
    };

    // --- 2. Watchlist Management ---
    const loadWatchlist = async () => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ action: 'watchlist/list' })
            });
            const data = await res.json();
            if (data.success) {
                allWatchlist = data.data;

                // Sync with search filter if any
                const term = document.getElementById('watchlist-search-input').value.toLowerCase();
                if (term) {
                    const filtered = allWatchlist.filter(item =>
                        item.symbol.toLowerCase().includes(term)
                    );
                    renderWatchlist(filtered);
                } else {
                    renderWatchlist(allWatchlist);
                }
            } else {
                console.error('Watchlist Error:', data.error);
                watchlistBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ef4444;">Error: ${data.error || 'Gagal memuat data'}</td></tr>`;
            }
        } catch (err) {
            console.error('Load Watchlist Error:', err);
            watchlistBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#ef4444;">Connection Error. Check Console.</td></tr>`;
        }
    };

    const renderWatchlist = (list) => {
        if (!list || list.length === 0) {
            watchlistBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px; color:rgba(255,255,255,0.5); font-style:italic;">Belum ada emiten yang dipantau.</td></tr>`;
            return;
        }
        watchlistBody.innerHTML = list.map(item => `
            <tr>
                <td style="font-weight: 600;">${item.symbol.replace('.JK', '')}</td>
                <td>
                    <span class="status-pill ${item.is_active ? 'status-active' : 'status-inactive'}">
                        ${item.is_active ? 'Active' : 'Paused'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn" onclick="toggleSymbol('${item.symbol}', ${!item.is_active})">
                            <i class="fas ${item.is_active ? 'fa-pause' : 'fa-play'}"></i>
                        </button>
                        <button class="icon-btn delete" onclick="deleteSymbol('${item.symbol}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    window.toggleSymbol = async (symbol, newState) => {
        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'watchlist/toggle', symbol, is_active: newState })
        });
        if (res.ok) loadWatchlist();
    };

    window.deleteSymbol = async (symbol) => {
        if (!confirm(`Hapus ${symbol} dari watchlist?`)) return;
        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'watchlist/delete', symbol })
        });
        if (res.ok) loadWatchlist();
    };

    document.getElementById('add-symbol-btn').onclick = async () => {
        const input = document.getElementById('new-symbol-input');
        const symbol = input.value.trim();
        if (!symbol) return;

        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'watchlist/add', symbol })
        });
        if (res.ok) {
            input.value = '';
            loadWatchlist();
        } else {
            const data = await res.json();
            alert(data.error || 'Gagal menambah emiten');
        }
    };

    // SEARCH LOGIC (Watchlist)
    document.getElementById('watchlist-search-input').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allWatchlist.filter(item =>
            item.symbol.toLowerCase().includes(term)
        );
        renderWatchlist(filtered);
    });

    // BATCH TOGGLE LOGIC
    document.getElementById('active-all-btn').onclick = () => batchToggleWatchlist(true);
    document.getElementById('pause-all-btn').onclick = () => batchToggleWatchlist(false);

    async function batchToggleWatchlist(newState) {
        if (!confirm(`Set semua emiten ke status ${newState ? 'ACTIVE' : 'PAUSED'}?`)) return;

        const btn = newState ? document.getElementById('active-all-btn') : document.getElementById('pause-all-btn');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'watchlist/batch-toggle', is_active: newState })
            });

            if (res.ok) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                loadWatchlist();
            } else {
                const data = await res.json();
                alert(data.error || 'Gagal mengubah status batch');
            }
        } catch (e) {
            console.error('Batch Toggle Error:', e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // --- 2.1 Table Expansion Logic ---
    const setupExpansion = (wrapperId, btnId) => {
        const wrapper = document.getElementById(wrapperId);
        const btn = document.getElementById(btnId);
        if (!wrapper || !btn) return;
        const btnText = btn.querySelector('span');
        const icon = btn.querySelector('i');

        btn.onclick = () => {
            const isExpanded = wrapper.classList.toggle('expanded');
            btnText.innerText = isExpanded ? 'Show Less' : 'Show All';
            if (icon) {
                icon.classList.toggle('fa-chevron-down', !isExpanded);
                icon.classList.toggle('fa-chevron-up', isExpanded);
            }
        };
    };

    setupExpansion('watchlist-wrapper', 'watchlist-toggle-btn');
    setupExpansion('users-wrapper', 'users-toggle-btn');

    // --- 3. Subscription Management ---
    const loadSubscriptionSettings = (loginData) => {
        // We get initial settings from login response for speed
        const user = loginData.user;
        isPaywallActive = user.paywall_mode || false;

        updatePaywallUI(isPaywallActive);
    };

    const updatePaywallUI = (active) => {
        isPaywallActive = active;
        paywallStatusText.innerText = active ? 'ON' : 'OFF';
        paywallBtn.classList.toggle('active', active);
        if (active) {
            paywallBtn.style.background = '#f59e0b';
            paywallBtn.style.color = '#fff';
        } else {
            paywallBtn.style.background = ''; // Reset
            paywallBtn.style.color = '';
        }
    };

    paywallBtn.onclick = async () => {
        const newState = !isPaywallActive;
        // Optimistic UI
        updatePaywallUI(newState);

        try {
            await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/update-paywall', paywall_mode: newState })
            });

            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
        } catch (e) {
            console.error(e);
            updatePaywallUI(!newState); // Revert
        }
    };

    // FEATURE PERMISSIONS REMOVED BY USER REQUEST
    const renderPermissions = (perms) => { return; };
    if (savePermissionsBtn) {
        savePermissionsBtn.onclick = () => { };
        savePermissionsBtn.style.display = 'none';
        if (permissionsContainer) permissionsContainer.style.display = 'none';
    }

    // --- 3.1 NEW LIMIT CONFIG LOGIC ---
    const limitChartToggle = document.getElementById('limit-chart-toggle');
    const limitAiToggle = document.getElementById('limit-ai-toggle');
    const limitAiCountInput = document.getElementById('limit-ai-count-input');
    const saveLimitConfigBtn = document.getElementById('save-limit-config-btn');

    const loadLimitConfig = async () => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/get-limit-config' })
            });
            const data = await res.json();
            if (data.success && data.config) {
                limitChartToggle.checked = data.config.limit_chart_mode;
                limitAiToggle.checked = data.config.limit_ai_mode;
                limitAiCountInput.value = data.config.limit_ai_count || 5;
            }
        } catch (e) { console.error('Load Limit Config Error:', e); }
    };

    saveLimitConfigBtn.onclick = async () => {
        const config = {
            limit_chart_mode: limitChartToggle.checked,
            limit_ai_mode: limitAiToggle.checked,
            limit_ai_count: parseInt(limitAiCountInput.value) || 5
        };

        saveLimitConfigBtn.disabled = true;
        saveLimitConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({
                    action: 'admin/settings/update-limit-config',
                    ...config
                })
            });

            if (res.ok) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                alert('Gagal menyimpan config');
            }
        } catch (e) { console.error(e); }

        saveLimitConfigBtn.disabled = false;
        saveLimitConfigBtn.innerHTML = '<i class="fas fa-save" style="margin-right: 5px;"></i> Simpan Limit Config';
    };

    // Auto load on init
    loadLimitConfig();

    // --- 4. User Management (Advanced) ---
    const loadUsers = async () => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/users/list' })
            });
            const data = await res.json();
            if (data.success) {
                allUsers = data.data;

                // Sync with search filter if any
                const term = userSearchInput.value.toLowerCase();
                if (term) {
                    const filtered = allUsers.filter(u =>
                        u.telegram_user_id.toString().includes(term) ||
                        (u.telegram_username && u.telegram_username.toLowerCase().includes(term))
                    );
                    renderUsers(filtered);
                } else {
                    renderUsers(allUsers);
                }
            } else {
                console.error('API Error (loadUsers):', data);
            }
        } catch (err) { console.error('Load Users Network Error:', err); }
    };

    const renderUsers = (users) => {
        const body = document.getElementById('users-body');

        // Logic for Statistics [NEW]
        const now = new Date();
        let activeCount = 0;
        let inactiveCount = 0;
        let onlineCount = 0;

        allUsers.forEach(u => {
            const isExpired = u.expires_at && new Date(u.expires_at) < now;
            if (isExpired) inactiveCount++;
            else activeCount++;

            // Online Logic: last_seen_at within 5 minutes
            if (u.last_seen_at) {
                const lastSeen = new Date(u.last_seen_at);
                const diffMinutes = (now - lastSeen) / (1000 * 60);
                if (diffMinutes < 2) onlineCount++;
            }
        });

        const activeEl = document.getElementById('active-users-count');
        const onlineEl = document.getElementById('online-users-count');
        const inactiveEl = document.getElementById('inactive-users-count');
        if (activeEl) activeEl.innerText = activeCount;
        if (onlineEl) onlineEl.innerText = onlineCount;
        if (inactiveEl) inactiveEl.innerText = inactiveCount;

        if (!users || users.length === 0) {
            body.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:30px; color:rgba(255,255,255,0.5);">User tidak ditemukan.</td></tr>`;
            return;
        }

        body.innerHTML = users.map(user => {
            const name = user.telegram_username || 'No Username';
            const level = user.membership_status || 'standard';
            const d = user.expires_at ? new Date(user.expires_at) : null;
            let expiryDate = 'No Date';
            if (d) {
                if (d.getFullYear() > 3000) expiryDate = 'Lifetime';
                else expiryDate = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            }
            const isExpired = user.expires_at && new Date(user.expires_at) < new Date();

            return `
                <tr>
                    <td>
                        <div style="font-weight:600; display:flex; align-items:center; gap:5px;">
                            ${name}
                            ${level === 'pro' ? '<span style="color:#fbbf24; font-size:0.7em;">★ PRO</span>' : ''}
                        </div>
                        <div class="user-id">ID: ${user.telegram_user_id}</div>
                    </td>
                    <td>
                        <div style="font-size: 0.85rem; font-weight: 600; color: ${isExpired ? '#ef4444' : '#10b981'};">
                            ${expiryDate} 
                            <span style="font-size: 0.7rem; opacity: 0.6; display: block;">
                                ${isExpired ? 'EXPIRED' : 'ACTIVE'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="icon-btn" onclick="updateUserLevel('${user.id}', '${level === 'pro' ? 'standard' : 'pro'}')" title="Toggle PRO">
                                <i class="fas ${level === 'pro' ? 'fa-star' : 'fa-star-half-alt'}"></i>
                            </button>
                            <button class="icon-btn" onclick="extendUser('${user.id}', 7)" title="+7 Hari">
                                <i class="fas fa-plus"></i> <span style="font-size:0.6rem; margin-left:2px;">7d</span>
                            </button>
                            <button class="icon-btn" onclick="extendUser('${user.id}', 30)" title="+30 Hari">
                                <i class="fas fa-plus"></i> <span style="font-size:0.6rem; margin-left:2px;">30d</span>
                            </button>
                            <button class="icon-btn" onclick="openExpiryModal('${user.id}', '${name.replace(/'/g, "\\'")}', '${user.expires_at}')" title="Set Expiry Date">
                                <i class="fas fa-calendar-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    // SEARCH LOGIC
    userSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u =>
            u.telegram_user_id.toString().includes(term) ||
            (u.telegram_username && u.telegram_username.toLowerCase().includes(term))
        );
        renderUsers(filtered);
    });

    window.updateUserLevel = async (userId, level) => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/users/update-level', userId, level })
            });
            if (res.ok) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                loadUsers();
            }
        } catch (err) { console.error(err); }
    };

    window.extendUser = async (userId, days) => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/users/extend', userId, days })
            });
            if (res.ok) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                loadUsers();
            }
        } catch (err) { console.error(err); }
    };

    window.toggleLiveMode = async (userId, is_live_eligible) => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/users/toggle-live', userId, is_live_eligible })
            });
            if (res.ok) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                loadUsers();
            }
        } catch (err) { console.error('Toggle Live Error:', err); }
    };

    // --- Expiry Modal Logic ---
    window.openExpiryModal = (userId, name, currentExpiry) => {
        activeExpiryUserId = userId;
        expiryUserLabel.innerText = `Mengatur masa aktif: ${name}`;

        // Format ISO date to YYYY-MM-DDTHH:MM for datetime-local
        if (currentExpiry) {
            const date = new Date(currentExpiry);
            const offset = date.getTimezoneOffset();
            const localDate = new Date(date.getTime() - (offset * 60 * 1000));
            expiryDateInput.value = localDate.toISOString().slice(0, 16);
        } else {
            expiryDateInput.value = '';
        }

        expiryModal.classList.remove('hidden');
    };

    cancelExpiryBtn.onclick = () => {
        expiryModal.classList.add('hidden');
        activeExpiryUserId = null;
    };

    confirmExpiryBtn.onclick = async () => {
        const expiryDate = expiryDateInput.value;
        if (!expiryDate || !activeExpiryUserId) return;

        confirmExpiryBtn.disabled = true;
        confirmExpiryBtn.innerText = 'Saving...';

        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({
                    action: 'admin/users/set-expiry',
                    userId: activeExpiryUserId,
                    expiryDate: new Date(expiryDate).toISOString()
                })
            });

            if (res.ok) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                expiryModal.classList.add('hidden');
                loadUsers();
            } else {
                const data = await res.json();
                alert(data.error || 'Gagal menyimpan tanggal kadaluarsa');
            }
        } catch (e) {
            console.error('Set Expiry Error:', e);
        } finally {
            confirmExpiryBtn.disabled = false;
            confirmExpiryBtn.innerText = 'Simpan';
        }
    };

    document.getElementById('add-user-btn').onclick = async () => {
        const input = document.getElementById('new-user-id-input');
        const telegram_user_id = input.value.trim();
        if (!telegram_user_id) return;

        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'admin/users/add', telegram_user_id })
        });

        if (res.ok) {
            input.value = '';
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            loadUsers();
        } else {
            const data = await res.json();
            alert(`Error: ${data.error || 'Gagal menambah user'}${data.details ? '\nDetail: ' + JSON.stringify(data.details) : ''}`);
        }
    };

    // --- 5. Maintenance Whitelist Logic ---
    let maintenanceWhitelist = [];

    async function loadMaintenanceWhitelist() {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/get-whitelist' })
            });
            const data = await res.json();
            if (data.success) {
                maintenanceWhitelist = data.whitelist || [];
                renderWhitelistTags();
            }
        } catch (e) { console.error('Whitelist Load Error:', e); }
    }

    function renderWhitelistTags() {
        if (maintenanceWhitelist.length === 0) {
            whitelistTagsContainer.innerHTML = `<span style="font-size: 0.75rem; color: #64748b; font-style: italic;">Belum ada pengecualian</span>`;
            return;
        }

        whitelistTagsContainer.innerHTML = maintenanceWhitelist.map(id => `
            <div style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(251, 191, 36, 0.3); font-size: 0.8rem; display: flex; align-items: center; gap: 8px;">
                <span>${id}</span>
                <i class="fas fa-times" style="cursor: pointer; opacity: 0.7;" onclick="removeFromWhitelist('${id}')"></i>
            </div>
        `).join('');
    }

    addWhitelistBtn.onclick = async () => {
        const newId = whitelistIdInput.value.trim();
        if (!newId) return;
        if (maintenanceWhitelist.includes(newId)) {
            alert('ID sudah ada di whitelist');
            return;
        }

        const newWhitelist = [...maintenanceWhitelist, newId];
        await updateWhitelistAPI(newWhitelist);
        whitelistIdInput.value = '';
    };

    window.removeFromWhitelist = async (id) => {
        const newWhitelist = maintenanceWhitelist.filter(item => item !== id);
        await updateWhitelistAPI(newWhitelist);
    };

    async function updateWhitelistAPI(newList) {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/update-whitelist', whitelist: newList })
            });
            const data = await res.json();
            if (data.success) {
                maintenanceWhitelist = newList;
                renderWhitelistTags();
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            }
        } catch (e) { console.error('Whitelist Update Error:', e); }
    }

    // --- 5.1 Live Mode Whitelist Logic ---
    let liveWhitelist = [];

    async function loadLiveWhitelist() {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/get-live-whitelist' })
            });
            const data = await res.json();
            if (data.success) {
                liveWhitelist = data.whitelist || [];
                renderLiveWhitelistTags();
            }
        } catch (e) { console.error('Live Whitelist Load Error:', e); }
    }

    function renderLiveWhitelistTags() {
        if (liveWhitelist.length === 0) {
            liveWhitelistTagsContainer.innerHTML = `<span style="font-size: 0.75rem; color: #64748b; font-style: italic;">Belum ada ID terdaftar</span>`;
            return;
        }

        liveWhitelistTagsContainer.innerHTML = liveWhitelist.map(id => `
            <div style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3); font-size: 0.8rem; display: flex; align-items: center; gap: 8px;">
                <span>${id}</span>
                <i class="fas fa-times" style="cursor: pointer; opacity: 0.7;" onclick="removeFromLiveWhitelist('${id}')"></i>
            </div>
        `).join('');
    }

    addLiveWhitelistBtn.onclick = async () => {
        const newId = liveWhitelistIdInput.value.trim();
        if (!newId) return;
        if (liveWhitelist.includes(newId)) {
            alert('ID sudah ada di whitelist');
            return;
        }

        const newWhitelist = [...liveWhitelist, newId];
        await updateLiveWhitelistAPI(newWhitelist);
        liveWhitelistIdInput.value = '';
    };

    window.removeFromLiveWhitelist = async (id) => {
        const newWhitelist = liveWhitelist.filter(item => item !== id);
        await updateLiveWhitelistAPI(newWhitelist);
    };

    async function updateLiveWhitelistAPI(newList) {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/update-live-whitelist', whitelist: newList })
            });
            const data = await res.json();
            if (data.success) {
                liveWhitelist = newList;
                renderLiveWhitelistTags();
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            }
        } catch (e) { console.error('Live Whitelist Update Error:', e); }
    }

    // --- 6. System Actions ---
    let mtInterval;

    const updateMTUI = (isOn, endTime) => {
        console.log('UpdateMTUI:', isOn, endTime);
        isMaintenanceActive = isOn;
        statusBadge.classList.toggle('maintenance-active', isOn);
        statusText.innerText = isOn ? 'Maintenance' : 'Online';
        const mtBtnText = document.getElementById('toggle-mt-btn').querySelector('span'); // Assuming mtBtnText is inside toggleMtBtn
        mtBtnText.innerText = `Maintenance: ${isOn ? 'ON' : 'OFF'}`;
        toggleMtBtn.classList.toggle('active', isOn);

        const countdownContainer = document.getElementById('admin-mt-countdown');
        const timerText = document.getElementById('amt-timer');
        const labelText = document.getElementById('mt-label');

        if (mtInterval) clearInterval(mtInterval);

        if (isOn) {
            countdownContainer.style.display = 'block';

            if (endTime) {
                const end = new Date(endTime).getTime();
                labelText.innerText = "Maintenance Auto-OFF in:";

                const tick = () => {
                    const now = new Date().getTime();
                    const distance = end - now;

                    if (distance < 0) {
                        clearInterval(mtInterval);
                        timerText.innerText = "Done! Reloading...";
                        setTimeout(() => location.reload(), 2000);
                        return;
                    }

                    const h = Math.floor(distance / (1000 * 60 * 60));
                    const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((distance % (1000 * 60)) / 1000);

                    timerText.innerText = `${h}h ${m}m ${s}s`;
                };
                tick();
                mtInterval = setInterval(tick, 1000);
            } else {
                labelText.innerText = "Status:";
                timerText.innerText = "Manual Mode (Active)";
            }
        } else {
            countdownContainer.style.display = 'none';
        }
    };

    // --- Maintenance Logic ---

    const mtModal = document.getElementById('mt-modal');
    const mtTitle = mtModal.querySelector('h3');
    const mtDesc = mtModal.querySelector('p');
    const mtInputGroup = mtModal.querySelector('.input-group');
    const confirmBtn = document.getElementById('confirm-mt-btn');
    const cancelBtn = document.getElementById('cancel-mt-btn');

    toggleMtBtn.onclick = () => {
        mtModal.classList.remove('hidden');

        if (isMaintenanceActive) {
            // UI for Turning OFF
            mtTitle.innerText = 'Matikan Maintenance?';
            mtDesc.innerText = 'User akan bisa kembali mengakses aplikasi.';
            mtInputGroup.classList.add('hidden');
            confirmBtn.innerText = 'Matikan Sekarang';
            confirmBtn.classList.remove('primary-btn');
            confirmBtn.style.backgroundColor = '#ef4444'; // Red for stop
            confirmBtn.style.borderColor = '#ef4444';
        } else {
            // UI for Turning ON
            mtTitle.innerText = 'Maintenance Mode';
            mtDesc.innerText = 'Aktifkan mode maintenance? User biasa tidak akan bisa login.';
            mtInputGroup.classList.remove('hidden');
            confirmBtn.innerText = 'Aktifkan';
            confirmBtn.classList.add('primary-btn');
            confirmBtn.style.backgroundColor = ''; // Reset
            confirmBtn.style.borderColor = '';
        }
    };

    cancelBtn.onclick = () => {
        mtModal.classList.add('hidden');
    };

    document.getElementById('confirm-mt-btn').onclick = () => {
        // If Active -> Turn Off
        if (isMaintenanceActive) {
            toggleMaintenanceAPI(null); // Send null to deactivate
            document.getElementById('mt-modal').classList.add('hidden');
            return;
        }

        // If Inactive -> Turn On logic
        const timeInput = document.getElementById('mt-time-input').value;
        let endTimeISO = null;

        if (timeInput) {
            const now = new Date();
            const [hours, minutes] = timeInput.split(':').map(Number);
            let target = new Date();
            target.setHours(hours, minutes, 0, 0);

            // If target time is earlier than now, assume it's for tomorrow
            if (target < now) {
                target.setDate(target.getDate() + 1);
            }
            endTimeISO = target.toISOString();
        }

        toggleMaintenanceAPI(endTimeISO);
        document.getElementById('mt-modal').classList.add('hidden');
    };

    async function toggleMaintenanceAPI(endTime) {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'toggle-maintenance', endTime })
            });
            const data = await res.json();
            if (data.success) {
                isMaintenanceActive = data.is_maintenance; // Sync state
                // Use backend returned time, or fallback to input
                const finalTime = data.maintenance_end_time || endTime;
                console.log('MT Toggle Success. State:', isMaintenanceActive, 'Time:', finalTime);
                updateMTUI(isMaintenanceActive, finalTime);
            }
        } catch (e) { console.error('MT Toggle Error:', e); }
    };

    // --- 7. IP Diagnostics & Cooldown [NEW] ---
    const loadIPStatus = async () => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/diagnostics/ip-status' })
            });
            const data = await res.json();
            if (data.success) {
                yfStatusText.innerText = data.yf_status;
                yfStatusText.style.color = data.yf_status === 'OK' ? '#10b981' : '#ef4444';
                serverIpText.innerText = data.ip;
            }
        } catch (e) { console.error('Load IP Status Error:', e); }
    };

    checkYfBtn.onclick = async () => {
        yfStatusText.innerText = 'Checking...';
        yfStatusText.style.color = '#94a3b8';
        const originalHtml = checkYfBtn.innerHTML;
        checkYfBtn.disabled = true;
        checkYfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/diagnostics/check-connection' })
            });
            const data = await res.json();
            if (data.success) {
                yfStatusText.innerText = data.yf_status;
                yfStatusText.style.color = data.yf_status === 'OK' ? '#10b981' : '#ef4444';
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(data.yf_status === 'OK' ? 'success' : 'error');
            }
        } catch (e) { console.error('Check Connection Error:', e); }
        finally {
            checkYfBtn.disabled = false;
            checkYfBtn.innerHTML = originalHtml;
        }
    };

    const loadCooldownSetting = async () => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/get-cooldown' })
            });
            const data = await res.json();
            if (data.success) {
                updateCooldownUI(data.is_cooldown, data.cooldown_end_time);
            }
        } catch (e) { console.error('Load Cooldown Error:', e); }
    };

    const updateCooldownUI = (isOn, endTime) => {
        isCooldownActive = isOn;
        cooldownStatusText.innerText = isOn ? 'ON' : 'OFF';
        cooldownBtn.classList.toggle('active', isOn);
        cooldownBtn.style.background = isOn ? '#fbbf24' : '';
        cooldownBtn.style.color = isOn ? '#000' : '';

        if (isOn && endTime) {
            cooldownTimer.style.display = 'block';
            const end = new Date(endTime).getTime();
            const tick = () => {
                const now = new Date().getTime();
                const diff = end - now;
                if (diff <= 0) {
                    cooldownTimer.innerText = "Ending...";
                    setTimeout(() => loadCooldownSetting(), 2000);
                    return;
                }
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                cooldownTimer.innerText = `Ends in: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            };
            tick();
            if (window.cooldownInterval) clearInterval(window.cooldownInterval);
            window.cooldownInterval = setInterval(tick, 1000);
        } else {
            cooldownTimer.style.display = 'none';
            if (window.cooldownInterval) clearInterval(window.cooldownInterval);
        }
    };

    cooldownBtn.onclick = async () => {
        const newState = !isCooldownActive;
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/settings/toggle-cooldown', is_cooldown: newState })
            });
            const data = await res.json();
            if (data.success) {
                updateCooldownUI(newState, data.cooldown_end_time);
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            }
        } catch (e) { console.error('Toggle Cooldown Error:', e); }
    };

    // Update initial state check


    document.getElementById('update-theme-btn').onclick = async () => {
        const theme = document.getElementById('theme-selector').value;

        // Optimistic UI Update
        if (window.themeEngine) {
            await window.themeEngine.applyTheme(theme);
        }

        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'admin/update-theme', theme })
        });
        if (res.ok) {
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            // alert('Tema berhasil diubah!'); 
            // No reload needed if UI updates instantly
        }
    };

    document.getElementById('force-scan-btn').onclick = async () => {
        const btn = document.getElementById('force-scan-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';

        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/force-scan' })
            });
            if (res.ok) {
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                alert('Scanner berhasil dijalankan di background!');
            }
        } catch (e) { console.error(e); }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Force Scan';
    };


    verifyAdmin();

    // --- 7. Auto-Refresh Logic (Online Status) ---
    // Refresh user list and stats every 30 seconds
    setInterval(() => {
        if (!document.hidden && sessionToken) {
            console.log('[ADMIN] Auto-refreshing user stats...');
            loadUsers();
        }
    }, 30000); // 30 seconds
});
