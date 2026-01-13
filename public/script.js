document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Telegram Web App with safety checks
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');
    }

    // --- DOM Elements Initialization ---
    const authOverlay = document.getElementById('auth-overlay');
    const authStatus = document.getElementById('auth-status');
    const paywallOverlay = document.getElementById('paywall-overlay');
    const tickerInput = document.getElementById('ticker-input');
    const addSymbolBtn = document.getElementById('add-symbol-btn');
    const terminalCard = document.getElementById('terminal-card');
    const terminalOutput = document.getElementById('terminal-output');
    const closeTerminalBtn = document.getElementById('close-terminal');
    const buttons = document.querySelectorAll('.glass-btn[data-action]');
    const reviewModal = document.getElementById('review-modal');
    const closeReviewBtn = document.getElementById('close-review');
    const submitReviewBtn = document.getElementById('submit-review');
    const avgModal = document.getElementById('avg-modal');
    const closeAvgBtn = document.getElementById('close-avg');
    const submitAvgBtn = document.getElementById('submit-avg');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    let sessionToken = localStorage.getItem('aston_session_token');
    let userMembershipStatus = 'standard';
    let isPaywallMode = false;
    let featurePermissions = {};
    let reviewAction = 'BUY'; // Default

    // --- Helper Functions ---

    const handleMaintenance = async (response) => {
        if (response.status === 503) {
            let endTime = null;
            try {
                const data = await response.json();
                if (data.end_time) endTime = data.end_time;
            } catch (e) {
                console.warn('Maintenance 503 received but not JSON.');
            }

            if (authOverlay) authOverlay.classList.add('hidden');
            const maintenanceOverlay = document.getElementById('maintenance-overlay');
            if (maintenanceOverlay) maintenanceOverlay.classList.remove('hidden');

            const statusParams = document.getElementById('mt-status-params');
            if (statusParams) {
                const targetTime = endTime ? new Date(endTime).getTime() : null;
                let timerHTML = `<div style="margin-top:15px; font-size: 0.9em; color: rgba(255,255,255,0.5); font-style:italic;">Mohon tunggu sebentar...</div>`;

                if (targetTime) {
                    timerHTML = `
                         <div id="mt-countdown" style="
                            display: inline-flex; gap: 15px; justify-content: center; 
                            background: rgba(15, 23, 42, 0.6); padding: 20px 30px; border-radius: 20px;
                            border: 1px solid rgba(251, 191, 36, 0.2); backdrop-filter: blur(10px);
                            margin-bottom: 25px; box-shadow: 0 4px 30px rgba(0,0,0,0.3);
                        ">
                            <div class="mt-unit">
                                <span id="mt-h" style="font-size:2.5em; font-weight:700; color:#fff; line-height:1;">00</span>
                                <span style="font-size:0.7em; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:5px;">Hours</span>
                            </div>
                            <div style="font-size:2.5em; color:#fbbf24; padding-top:0px; opacity:0.5;">:</div>
                            <div class="mt-unit">
                                <span id="mt-m" style="font-size:2.5em; font-weight:700; color:#fff; line-height:1;">00</span>
                                <span style="font-size:0.7em; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:5px;">Mins</span>
                            </div>
                            <div style="font-size:2.5em; color:#fbbf24; padding-top:0px; opacity:0.5;">:</div>
                            <div class="mt-unit">
                                <span id="mt-s" style="font-size:2.5em; font-weight:700; color:#fff; line-height:1;">00</span>
                                <span style="font-size:0.7em; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:5px;">Secs</span>
                            </div>
                        </div>
                        <div style="font-size: 0.9em; color: rgba(255,255,255,0.5); font-style:italic;">Estimated completion time.</div>
                    `;
                }

                statusParams.innerHTML = `
                    <div style="text-align:center; animation: fadeIn 1s ease;">
                        <div style="margin-bottom:20px;">
                            <h2 style="font-size:1.8em; font-weight:800; color:#fbbf24; text-transform:uppercase; letter-spacing:2px; margin:0; text-shadow:0 0 20px rgba(251,191,36,0.3);">
                                System Upgrade
                            </h2>
                            <p style="color:#94a3b8; font-size:0.9em; margin-top:5px;">We are improving your experience</p>
                        </div>
                        ${timerHTML}
                    </div>
                `;

                if (targetTime) {
                    if (window.mtInterval) clearInterval(window.mtInterval);
                    window.mtInterval = setInterval(() => {
                        const now = new Date().getTime();
                        const distance = targetTime - now;
                        if (distance < 0) {
                            clearInterval(window.mtInterval);
                            statusParams.innerHTML = '<div style="color:#10b981; font-weight:bold; font-size:1.5em; animation:fadeIn 0.5s;">System Online! Reloading...</div>';
                            setTimeout(() => location.reload(), 2000);
                            return;
                        }
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                        const elH = document.getElementById('mt-h');
                        const elM = document.getElementById('mt-m');
                        const elS = document.getElementById('mt-s');
                        if (elH) elH.innerText = String(hours).padStart(2, '0');
                        if (elM) elM.innerText = String(minutes).padStart(2, '0');
                        if (elS) elS.innerText = String(seconds).padStart(2, '0');
                    }, 1000);
                }
            }

            if (window.themeEngine) window.themeEngine.applyTheme('default');
            const container = document.querySelector('.container');
            if (container) {
                container.style.filter = 'blur(10px)';
                container.style.pointerEvents = 'none';
            }
            return true;
        }
        return false;
    };

    const handleCooldown = (data) => {
        if (data && data.error === 'COOLDOWN') {
            const cooldownOverlay = document.getElementById('cooldown-overlay');
            if (cooldownOverlay) {
                cooldownOverlay.classList.remove('hidden');
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            }
            // Hide terminal if active
            if (terminalCard) terminalCard.classList.add('hidden');
            return true;
        }
        return false;
    };

    const syncTheme = (data) => {
        if (data && data.active_theme && window.themeEngine) {
            if (data.active_theme !== window.themeEngine.activeTheme) {
                window.themeEngine.applyTheme(data.active_theme);
            }
        }
    };

    const showLoading = (text) => {
        // Close overlays
        const cdOverlay = document.getElementById('cooldown-overlay');
        if (cdOverlay) cdOverlay.classList.add('hidden');

        if (terminalCard) terminalCard.classList.remove('hidden');
        if (terminalOutput) {
            terminalOutput.innerHTML = `
                <div class="loading-pulse">
                    <div class="loader-chart">
                        <div class="loader-bar"></div>
                        <div class="loader-bar"></div>
                        <div class="loader-bar"></div>
                        <div class="loader-bar"></div>
                    </div>
                    <span>${text}...</span>
                </div>
            `;
        }
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    };

    const showResult = (html) => {
        const contentDiv = document.createElement('div');
        contentDiv.style.animation = 'fadeInUp 0.3s ease-out';
        contentDiv.innerHTML = html;
        if (terminalOutput) {
            terminalOutput.innerHTML = '';
            terminalOutput.appendChild(contentDiv);
        }
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    };

    const showError = (msg) => {
        if (terminalOutput) {
            terminalOutput.innerHTML = `<span style="color: #ef4444; font-weight: 500;">⚠ Error: ${msg}</span>`;
        }
        if (terminalCard) terminalCard.classList.remove('hidden');
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    };

    const renderDynamicBadges = () => {
        const buttons = document.querySelectorAll('.glass-btn[data-action]');
        buttons.forEach(btn => {
            const action = btn.dataset.action;
            const actionToKey = {
                'analysis': 'analysis', 'signal': 'signal', 'fundamental': 'fundamental',
                'proxy': 'proxy', 'profile': 'profile', 'avg-page': 'avg',
                'review-modal': 'review', 'smart-chart': 'chart-live'
            };
            const permissionKey = actionToKey[action];
            const isGated = isPaywallMode && featurePermissions[permissionKey] === 'pro';
            const specialBadge = btn.querySelector('.trending-badge');

            if (isGated) {
                if (specialBadge) {
                    specialBadge.innerText = 'PRO';
                    specialBadge.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                    specialBadge.style.animation = 'pulse-gold 2s infinite';
                } else if (!btn.querySelector('.pro-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'pro-badge';
                    badge.innerText = 'PRO';
                    btn.appendChild(badge);
                }
            } else {
                if (specialBadge) {
                    specialBadge.innerText = 'Trending';
                    specialBadge.style.background = '';
                    specialBadge.style.animation = '';
                }
                const proBadge = btn.querySelector('.pro-badge');
                if (proBadge) proBadge.remove();
            }
        });
    };

    const checkGatedAction = (action) => {
        if (!isPaywallMode || userMembershipStatus === 'pro') return true;
        const actionToKey = {
            'analysis': 'analysis', 'signal': 'signal', 'fundamental': 'fundamental',
            'proxy': 'proxy', 'profile': 'profile', 'avg-page': 'avg',
            'review-modal': 'review', 'smart-chart': 'chart-live'
        };
        const permissionKey = actionToKey[action];
        if (permissionKey && featurePermissions[permissionKey] === 'pro') {
            if (paywallOverlay) paywallOverlay.classList.remove('hidden');
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return false;
        }
        return true;
    };

    const login = async () => {
        if (!tg || !tg.initData) {
            if (authStatus) authStatus.innerHTML = '<span style="color: #ef4444;">Please open this app inside Telegram.</span>';
            return;
        }

        // --- OPTIMISTIC LOGIN (Local Cache) ---
        let isOptimisticLogin = false;
        try {
            const cachedUser = localStorage.getItem('cached_user_data');
            if (cachedUser) {
                const user = JSON.parse(cachedUser);
                console.log('[CACHE] Restoring User Data:', user.telegram_id);

                // Immediate UI Updates
                if (authOverlay) authOverlay.classList.add('hidden');

                // Restore logic state
                userMembershipStatus = user.membership_status || 'standard';
                isPaywallMode = user.paywall_mode || false;
                featurePermissions = user.feature_permissions || {};

                // UI Elements state restoration
                const adminBtn = document.getElementById('admin-toggle-btn');
                const statusBadge = document.getElementById('app-status-badge');
                const statusText = document.getElementById('status-text');

                if (statusBadge && statusText) {
                    if (user.is_maintenance) {
                        statusBadge.classList.add('maintenance-active');
                        statusText.innerText = 'Maintenance';
                    } else {
                        statusBadge.classList.remove('maintenance-active');
                        statusText.innerText = 'Online';
                    }
                }

                if (user.is_admin === true && adminBtn) {
                    adminBtn.classList.remove('hidden');
                    adminBtn.onclick = () => {
                        window.location.href = 'admin.html';
                    };
                }

                // Apply Theme (Silent)
                if (user.active_theme && window.themeEngine) {
                    window.themeEngine.applyTheme(user.active_theme);
                }

                renderDynamicBadges();
                isOptimisticLogin = true;
            }
        } catch (e) {
            console.warn('[CACHE] Failed to load cached user', e);
        }

        try {
            // Only show visible loading if NOT optimistic
            if (!isOptimisticLogin && authStatus) authStatus.innerText = 'Loading bentar...';

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });

            if (await handleMaintenance(response.clone())) return;

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}`);
            }

            const data = await response.json();
            if (response.ok && data.success) {
                sessionToken = data.token;
                localStorage.setItem('aston_session_token', sessionToken);

                // --- UPDATE CACHE ---
                localStorage.setItem('cached_user_data', JSON.stringify(data.user));

                // Force hide overlay if it wasn't hidden by optimistic login
                if (authOverlay) authOverlay.classList.add('hidden');

                const user = data.user;
                const adminBtn = document.getElementById('admin-toggle-btn');
                const statusBadge = document.getElementById('app-status-badge');
                const statusText = document.getElementById('status-text');

                const updateStatusBadge = (isMt) => {
                    if (statusBadge && statusText) {
                        if (isMt) {
                            statusBadge.classList.add('maintenance-active');
                            statusText.innerText = 'Maintenance';
                        } else {
                            statusBadge.classList.remove('maintenance-active');
                            statusText.innerText = 'Online';
                        }
                    }
                };
                updateStatusBadge(user.is_maintenance);

                if (user.is_admin === true && adminBtn) {
                    adminBtn.classList.remove('hidden');
                    adminBtn.onclick = () => {
                        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                        window.location.href = 'admin.html';
                    };
                } else if (adminBtn) {
                    adminBtn.classList.add('hidden');
                }

                if (data.user.active_theme && window.themeEngine) {
                    await window.themeEngine.applyTheme(data.user.active_theme);
                }

                userMembershipStatus = user.membership_status || 'standard';
                isPaywallMode = user.paywall_mode || false;
                featurePermissions = user.feature_permissions || {};
                renderDynamicBadges();

                if (!isOptimisticLogin && tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            } else {
                if (data.code === 'MAINTENANCE_MODE') {
                    location.reload();
                    return;
                }

                // IF Auth fails, clear cache so user doesn't get stuck in optimistic state with invalid token
                localStorage.removeItem('cached_user_data');

                if (authStatus) {
                    if (data.code === 'NOT_MEMBER') {
                        authStatus.innerHTML = `
                            <div style="color: #ef4444; margin-bottom: 15px; font-weight: 600;">${data.error}</div>
                            <div style="margin-bottom: 20px; font-size: 0.9em; opacity: 0.8;">Jika sudah join silahkan buka ulang App</div>
                            <a href="https://t.me/astongrup" target="_blank" class="glass-btn primary-btn" style="text-decoration: none; padding: 12px 24px; display: inline-block;">🚀 Masuk Grup</a>
                        `;
                    } else {
                        authStatus.innerHTML = `
                            <div style="color: #ef4444; margin-bottom: 10px;">${data.error || 'Authentication Failed'}</div>
                            <button class="glass-btn" onclick="location.reload()" style="padding: 10px 20px; font-size: 0.8rem;">Retry</button>
                        `;
                    }
                }
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        } catch (err) {
            console.error('Login error:', err);
            // If optimistic login worked, we can silence usage errors or show a small toast, but avoiding full block is key.
            // For now, if NOT optimistic, show error.
            if (!isOptimisticLogin && authStatus) {
                authStatus.innerHTML = `
                    <div style="color: #ef4444; margin-bottom: 10px; font-size:0.85em;">Error: ${err.message}</div>
                    <button class="glass-btn" onclick="location.reload()" style="padding: 10px 20px; font-size: 0.8rem;">Retry</button>
                `;
            }
        }
    };

    // --- Watchlist Logic ---
    let watchlistData = [];
    let pollingInterval = null;

    const fetchMarketSummary = async () => {
        // --- CACHE FIRST ---
        const cachedMarket = localStorage.getItem('cached_market_data');
        const updateUI = (id, symbol, price, change) => {
            const el = document.getElementById(id);
            if (el) {
                const isUp = change >= 0;
                const color = isUp ? '#22c55e' : '#ef4444';
                const sign = isUp ? '+' : '';
                el.innerHTML = `
                    ${price.toLocaleString()} 
                    <span style="color:${color}; font-size:0.8em; margin-left:4px;">
                        (${sign}${change.toFixed(2)}%)
                    </span>
                `;
            }
        };

        if (cachedMarket) {
            try {
                const data = JSON.parse(cachedMarket);
                const ihsg = data.find(x => x.symbol === '^JKSE');
                const usd = data.find(x => x.symbol === 'USDIDR=X');
                if (ihsg) updateUI('market-ihsg', '^JKSE', ihsg.regularMarketPrice, ihsg.regularMarketChangePercent || 0);
                if (usd) updateUI('market-usd', 'USDIDR=X', usd.regularMarketPrice, usd.regularMarketChangePercent || 0);
            } catch (e) { console.error(e) }
        }

        // --- NETWORK FETCH ---
        try {
            if (!sessionToken) return;

            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'quote', symbol: '^JKSE,USDIDR=X' })
            });

            if (response.ok) {
                const res = await response.json();
                if (res.success && Array.isArray(res.data)) {
                    // Update Cache
                    localStorage.setItem('cached_market_data', JSON.stringify(res.data));

                    const ihsg = res.data.find(x => x.symbol === '^JKSE');
                    const usd = res.data.find(x => x.symbol === 'USDIDR=X');
                    if (ihsg) updateUI('market-ihsg', '^JKSE', ihsg.regularMarketPrice, ihsg.regularMarketChangePercent || 0);
                    if (usd) updateUI('market-usd', 'USDIDR=X', usd.regularMarketPrice, usd.regularMarketChangePercent || 0);
                }
            }
        } catch (e) {
            console.error('Market Summary fetch failed', e);
        }
    };

    const loadWatchlist = async () => {
        try {
            const container = document.getElementById('watchlist-container');
            if (!container) return; // safety

            // --- OPTIMISTIC WATCHLIST LOAD ---
            let hasCache = false;
            // Only use cache if we have no live data yet
            if (watchlistData.length === 0) {
                const cachedWL = localStorage.getItem('cached_watchlist');
                if (cachedWL) {
                    try {
                        const parsed = JSON.parse(cachedWL);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            console.log('[CACHE] Rendering Watchlist from Cache');
                            renderWatchlist(parsed);
                            hasCache = true;
                        }
                    } catch (e) {
                        console.warn('WL Cache Parse Error', e);
                    }
                }
            }

            // Only show loading spinner if NO data and NO cache
            // Note: If container has existing content (cache), we don't clear it.
            // If it's empty and no cache, existing HTML pulse remains.

            const response = await fetch('/api/watchlist', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });

            if (response.status === 401) {
                // Token Expired / Invalid
                localStorage.removeItem('cached_user_data');
                location.reload(); // Force re-auth
                return;
            }

            if (response.ok) {
                const res = await response.json();
                if (res.success) {
                    isPaywallMode = res.paywall_mode;

                    // Update Cache
                    localStorage.setItem('cached_watchlist', JSON.stringify(res.data));

                    renderWatchlist(res.data);
                }
            }
        } catch (err) {
            console.error('Watchlist Load Error:', err);
        }
    };

    const renderWatchlist = (newData) => {
        const container = document.getElementById('watchlist-container');
        if (!container) return;

        // Limit Logic & Counter
        // Limit Logic & Counter
        let limit = 50; // Default high safety cap
        if (isPaywallMode) {
            limit = (userMembershipStatus === 'standard') ? 4 : 8;
        } else {
            limit = 50; // Unlimited effectively
        }
        const currentCount = newData.length;
        const isFull = currentCount >= limit;

        // Update Limit Bar
        let limitBar = document.getElementById('wl-limit-bar');
        if (!limitBar) {
            limitBar = document.createElement('div');
            limitBar.id = 'wl-limit-bar';
            limitBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 5px; font-size:0.8rem; color:var(--text-secondary);';
            // Insert before container
            if (container.parentElement) container.parentElement.insertBefore(limitBar, container);
        }

        const limitColor = isFull ? '#ef4444' : 'var(--text-secondary)';
        limitBar.innerHTML = `
            <span>My Watchlist</span>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color:${limitColor}; font-weight:bold;">${currentCount} / ${limit}</span>
                <button id="wl-add-btn" class="glass-btn" style="padding: 4px 12px; font-size: 0.75rem; min-height: auto; border-radius: 8px; background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.4); color: white;">
                    Add
                </button>
            </div>
        `;

        // Attach event listener immediately after creating the element
        setTimeout(() => {
            const addBtn = document.getElementById('wl-add-btn');
            if (addBtn) addBtn.onclick = openAddMenu;
        }, 0);

        if (newData.length === 0) {
            container.innerHTML = `
                <div class="watchlist-empty">
                    <i class="fas fa-chart-line"></i>
                    <p>Belum ada saham pantauan.</p>
                    <button class="glass-btn primary-btn" id="empty-add-btn" style="width:auto;">Mulai Pantau</button>
                </div>
            `;
            setTimeout(() => {
                const btn = document.getElementById('empty-add-btn');
                if (btn) btn.onclick = openAddMenu;
            }, 0);
            watchlistData = [];
            return;
        }

        // Smart Render: Update existing or create new to avoid flickering
        // Map old data for diffing
        const oldMap = new Map(watchlistData.map(d => [d.symbol, d]));

        // If first render, clear container
        if (watchlistData.length === 0) container.innerHTML = '';

        // We assume order matches or we re-render list if length changes substantially
        // For simplicity: If length diff, full re-render. If same, update cells.
        if (newData.length !== watchlistData.length) {
            container.innerHTML = '';
            newData.forEach(item => {
                container.appendChild(createWatchlistItem(item));
            });
        } else {
            // Update in place
            newData.forEach(item => {
                const existingEl = document.getElementById(`wl-item-${item.symbol}`);
                if (existingEl) {
                    updateWatchlistItem(existingEl, item, oldMap.get(item.symbol));
                } else {
                    container.appendChild(createWatchlistItem(item)); // New item added via polling
                }
            });

            // Remove items that are no longer in the list (Deleted)
            const newSymbolSet = new Set(newData.map(i => i.symbol));
            const allItems = container.querySelectorAll('.watchlist-item[id^="wl-item-"]');
            allItems.forEach(el => {
                const sym = el.id.replace('wl-item-', '');
                if (!newSymbolSet.has(sym)) {
                    el.remove();
                }
            });
        }

        // --- APPEND STATIC SECTOR CARD (User Request) ---
        // This makes the "Rotasi Sektor" button appear as the last item in the list
        // Remove existing sector card if any (to avoid duplicates on re-render)
        const oldSector = document.getElementById('sector-static-card');
        if (oldSector) oldSector.remove();

        const sectorCard = document.createElement('div');
        sectorCard.id = 'sector-static-card';
        sectorCard.className = 'watchlist-item';
        // Match existing style
        sectorCard.style.padding = '15px';
        sectorCard.style.background = 'rgba(251, 191, 36, 0.05)'; // Subtle gold tint
        sectorCard.style.marginTop = '10px'; // Separation
        sectorCard.style.cursor = 'pointer';

        sectorCard.innerHTML = `
            <div class="wl-identity">
                <div class="wl-symbol" style="color: #fbbf24; font-weight:700;">SECTORS</div>
                <div class="wl-name" style="opacity:0.8;">Market Rotation Map</div>
            </div>
            <div class="wl-price-box" style="align-items: center; justify-content: center; width: 40px; margin-left:auto;">
                 <i class="fas fa-map-marked-alt" style="font-size: 1.4rem; color: #fbbf24;"></i>
            </div>
        `;

        sectorCard.onclick = () => {
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            window.location.href = 'sectors.html';
        };

        container.appendChild(sectorCard);

        watchlistData = newData;
    };

    const deleteFromWatchlist = async (symbol) => {
        if (!confirm(`Hapus ${symbol} dari watchlist?`)) return;
        try {
            // Optimistic Update
            watchlistData = watchlistData.filter(i => i.symbol !== symbol);
            renderWatchlist(watchlistData);

            const response = await fetch(`/api/watchlist?symbol=${symbol}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            if (!response.ok) {
                loadWatchlist(); // Revert on failure
                alert('Gagal menghapus.');
            } else {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            }
        } catch (e) {
            console.error(e);
            loadWatchlist();
        }
    };

    const createWatchlistItem = (item) => {
        const div = document.createElement('div');
        div.className = 'watchlist-item';
        // --- Long Press Logic ---
        let pressTimer;
        let isLongPress = false;

        const startPress = (e) => {
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
                openContextMenu(item.symbol);
            }, 600); // 600ms long press
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        // Touch Events
        div.addEventListener('touchstart', startPress, { passive: true });
        div.addEventListener('touchend', cancelPress);
        div.addEventListener('touchmove', cancelPress);

        // Mouse Events (for Desktop testing)
        div.addEventListener('mousedown', startPress);
        div.addEventListener('mouseup', cancelPress);
        div.addEventListener('mouseleave', cancelPress);

        // Click Handler (only if NOT long press)
        // Context Menu (Right Click) - Desktop Support
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation(); // prevent default browser menu
            openContextMenu(item.symbol);
        });

        // Click Handler (only if NOT long press)
        div.onclick = (e) => {
            if (isLongPress) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            // Ignore click if it was on the Menu Button properties
            if (e.target.closest('.wl-menu-btn')) return;

            openChart(item.symbol);
        };

        const isUp = item.change >= 0;
        const colorClass = isUp ? 'up' : 'down';
        const trendClass = isUp ? 'uptrend' : 'downtrend';
        const pulseClass = isUp ? 'bull' : 'bear';
        const sign = isUp ? '+' : '';

        // Use Real Sparkline if available, otherwise fallback to simple line
        let sparkPath = '';
        if (item.sparkline && Array.isArray(item.sparkline) && item.sparkline.length > 2) {
            sparkPath = renderRealSparkline(item.sparkline);
        } else {
            // Fallback: Generate a flat line or simple path
            sparkPath = `M 0 15 L 100 15`;
        }

        div.innerHTML = `
            <div class="wl-identity">
                <div class="wl-symbol">
                    ${item.symbol}
                    <span class="wl-pulse ${pulseClass}"></span>
                </div>
                <div class="wl-name">ASTON AI TRACK</div>
            </div>
            <div class="wl-sparkline ${trendClass}">
                <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                    <path class="spark-line" d="${sparkPath}" vector-effect="non-scaling-stroke"></path>
                    <path class="spark-fill" d="${sparkPath} V 30 H 0 Z" vector-effect="non-scaling-stroke"></path>
                </svg>
            </div>
            <div class="wl-price-box">
                <div class="wl-price" id="price-${item.symbol}">${item.price ? item.price.toLocaleString() : '-'}</div>
                <div class="wl-change ${colorClass}" id="change-${item.symbol}">${sign}${item.changePercent ? item.changePercent.toFixed(2) : '0.00'}%</div>
            </div>
        `;

        div.id = `wl-item-${item.symbol}`; // Restore ID for updates

        return div;
    };

    const updateWatchlistItem = (el, newItem, oldItem) => {
        if (!oldItem) return;

        const priceEl = el.querySelector(`#price-${newItem.symbol}`);
        const changeEl = el.querySelector(`#change-${newItem.symbol}`);

        // Update Text
        if (priceEl) priceEl.innerText = newItem.price ? newItem.price.toLocaleString() : '-';
        if (changeEl) {
            const isUp = newItem.change >= 0;
            const sign = isUp ? '+' : '';
            changeEl.innerText = `${sign}${newItem.changePercent ? newItem.changePercent.toFixed(2) : '0.00'}%`;
            changeEl.className = `wl-change ${isUp ? 'up' : 'down'}`;
        }

        if (newItem.price !== oldItem.price) {
            const flashClass = newItem.price > oldItem.price ? 'flash-up' : 'flash-down';
            const priceBox = el.querySelector('.wl-price-box');
            if (priceBox) {
                priceBox.classList.remove('flash-up', 'flash-down');
                void priceBox.offsetWidth; // trigger reflow
                priceBox.classList.add(flashClass);
            }
        }

        // [FIX] Update Sparkline Dynamically
        if (newItem.sparkline && Array.isArray(newItem.sparkline) && newItem.sparkline.length > 2) {
            const sparkLinePath = el.querySelector('.spark-line');
            const sparkFillPath = el.querySelector('.spark-fill');
            if (sparkLinePath && sparkFillPath) {
                const d = renderRealSparkline(newItem.sparkline);
                sparkLinePath.setAttribute('d', d);
                sparkFillPath.setAttribute('d', `${d} V 30 H 0 Z`);

                // Also update trend color
                const sparkContainer = el.querySelector('.wl-sparkline');
                if (sparkContainer) {
                    const isUp = (newItem.change >= 0); // Or check sparkline trend?
                    sparkContainer.className = `wl-sparkline ${isUp ? 'uptrend' : 'downtrend'}`;
                }
            }
        }
    };

    const generateSparklinePath = (isUp) => {
        // Generate a random-looking but directional path 
        // 0,15 -> ... -> 100, (isUp ? 5 : 25)
        let d = "M 0 15 ";
        let y = 15;
        for (let x = 10; x <= 90; x += 10) {
            y += Math.random() * 10 - 5;
            d += `L ${x} ${y} `;
        }
        d += `L 100 ${isUp ? 5 : 25}`;
        return d;
    };

    const openChart = (symbol) => {
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        window.location.href = `chart.html?symbol=${symbol}`;
    };

    const addToWatchlist = async () => {
        const input = document.getElementById('ticker-input');
        const symbol = input.value.trim().toUpperCase();
        if (!symbol) return;

        const confirmBtn = document.getElementById('confirm-add-btn');
        const originalText = confirmBtn.innerText;
        confirmBtn.innerText = '...';

        try {
            const response = await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'add', symbol })
            });

            const data = await response.json();
            if (data.success) {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                input.value = '';
                closeAddMenu();
                loadWatchlist(); // Refresh
            } else {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                alert(data.error || 'Failed to add');
            }
        } catch (e) {
            alert('Network Error');
        } finally {
            confirmBtn.innerText = originalText;
        }
    };

    // --- Add Menu Logic ---
    const addMenuModal = document.getElementById('add-menu-modal');
    // const addSymbolBtn is now declared at the top
    const closeAddMenuBtn = document.getElementById('close-add-menu');
    const confirmAddBtn = document.getElementById('confirm-add-btn');

    const openAddMenu = () => {
        // Limit Check
        const limit = (isPaywallMode && userMembershipStatus === 'standard') ? 4 : 8;
        if (watchlistData.length >= limit) {
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            alert(`Limit Watchlist Tercapai (${limit} Saham). ${isPaywallMode && userMembershipStatus === 'standard' ? 'Upgrade ke PRO untuk lebih banyak!' : ''}`);
            return;
        }

        if (addMenuModal) addMenuModal.classList.remove('hidden');
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    };

    const closeAddMenu = () => {
        if (addMenuModal) addMenuModal.classList.add('hidden');
    };

    // --- Context Menu Logic ---
    const ctxModal = document.getElementById('watchlist-context-modal');
    const ctxTitle = document.getElementById('context-symbol-title');
    const closeCtxBtn = document.getElementById('close-context-menu');
    let currentCtxSymbol = null;

    const openContextMenu = (symbol) => {
        currentCtxSymbol = symbol;
        if (ctxTitle) ctxTitle.innerText = `${symbol} Actions`;
        if (ctxModal) ctxModal.classList.remove('hidden');
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    };

    const closeContextMenu = () => {
        if (ctxModal) ctxModal.classList.add('hidden');
        currentCtxSymbol = null;
    };

    if (closeCtxBtn) closeCtxBtn.addEventListener('click', closeContextMenu);

    // Context Menu Actions
    const handleCtxAction = (type) => {
        const symbol = currentCtxSymbol; // Capture before closing
        if (!symbol) return;

        closeContextMenu();

        switch (type) {
            case 'chart':
                window.location.href = `chart.html?symbol=${symbol}`;
                break;
            case 'analysis':
                window.location.href = `chat.html?mode=analysis&symbol=${symbol}`;
                break;
            case 'signal':
                window.location.href = `chat.html?mode=signal&symbol=${symbol}`;
                break;
            case 'proxy': // Bandar -> Chat Interface (Text Analysis)
                window.location.href = `chat.html?mode=proxy&symbol=${symbol}`;
                break;
            case 'fund':
                window.location.href = `fundamental.html?symbol=${symbol}`;
                break;
            case 'avg':
                // Redirect to Avg Calc (pass symbol if supported, usually Avg Page picks it up or needs update)
                // Assuming avg.html handles symbol param or user types it.
                window.location.href = `avg.html?symbol=${symbol}`;
                break;
            case 'profile':
                // Map Profile to Fundamental for now as we don't have dedicated profile page yet
                window.location.href = `fundamental.html?symbol=${symbol}&tab=profile`;
                break;
            case 'review':
                // New Review Logic
                const modal = document.getElementById('review-modal');
                const title = modal.querySelector('.card-header h3');
                if (title) title.innerText = `Review ${symbol}`;

                // FIX: Store symbol in dataset to persist even if ctx menu closes
                if (modal) modal.dataset.symbol = symbol;

                // Reset to form
                const formBody = document.getElementById('review-form-body');
                const resContainer = document.getElementById('review-result-container');
                if (formBody) formBody.classList.remove('hidden');
                if (resContainer) {
                    resContainer.classList.add('hidden');
                    resContainer.innerHTML = '';
                }

                // Clear inputs
                const entryInput = document.getElementById('review-entry');
                const slInput = document.getElementById('review-sl');
                if (entryInput) entryInput.value = '';
                if (slInput) slInput.value = '';

                if (modal) modal.classList.remove('hidden');
                break;
            case 'delete':
                deleteFromWatchlist(symbol);
                break;
            default:
                closeContextMenu();
                alert(`Coming Soon: ${type}`);
        }
    };

    // Wire up buttons
    ['chart', 'analysis', 'fund', 'signal', 'avg', 'profile', 'proxy', 'review', 'delete'].forEach(act => {
        const btn = document.getElementById(`ctx-btn-${act}`);
        if (btn) btn.onclick = () => handleCtxAction(act);
    });

    if (addSymbolBtn) {
        addSymbolBtn.addEventListener('click', openAddMenu);
    }
    if (closeAddMenuBtn) closeAddMenuBtn.addEventListener('click', closeAddMenu);
    if (confirmAddBtn) confirmAddBtn.addEventListener('click', addToWatchlist);

    // --- Review Modal Logic ---
    const reviewToggleBtns = document.querySelectorAll('#review-modal .toggle-btn');
    reviewToggleBtns.forEach(btn => {
        btn.onclick = () => {
            reviewToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reviewAction = btn.dataset.value;
        };
    });

    if (closeReviewBtn) {
        closeReviewBtn.onclick = () => {
            if (reviewModal) reviewModal.classList.add('hidden');
        };
    }

    if (submitReviewBtn) {
        submitReviewBtn.onclick = async () => {
            // Basic Check
            if (!checkGatedAction('review-modal')) return;

            const entry = document.getElementById('review-entry').value;
            const sl = document.getElementById('review-sl').value;

            // FIX: Use stored symbol from dataset to persist even if ctx menu closes
            const modal = document.getElementById('review-modal');
            const symbol = modal.dataset.symbol || currentCtxSymbol;

            if (!entry) {
                alert('Entry Price wajib diisi');
                return;
            }
            if (!symbol) {
                alert('Error: Symbol not found. Please re-open menu.');
                return;
            }

            const originalText = submitReviewBtn.innerText;
            submitReviewBtn.innerText = 'Analyzing...';
            submitReviewBtn.disabled = true;

            // --- 1. SHOW LOADING ANIMATION ---
            const formBody = document.getElementById('review-form-body');
            const resultContainer = document.getElementById('review-result-container');
            formBody.classList.add('hidden');
            resultContainer.classList.remove('hidden');

            resultContainer.innerHTML = `
                <div class="loading-pulse" style="padding: 40px 20px;">
                <div class="loader-chart">
                    <div class="loader-bar"></div>
                    <div class="loader-bar"></div>
                    <div class="loader-bar"></div>
                    <div class="loader-bar"></div>
                </div>
                    <div style="margin-top: 20px; font-size: 1.1em; color: #94a3b8;">Analyzing ${symbol}...</div>
                    <div style="font-size: 0.8em; color: #64748b; margin-top: 5px;">AI is calculating score & risk</div>
                </div>
            `;

            try {
                const response = await fetch('/api/web', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                    body: JSON.stringify({
                        action: 'review',
                        symbol: symbol,
                        mode: reviewAction,
                        entry: entry,
                        sl: sl
                    })
                });

                // --- 2. HANDLE JSON RESPONSE ---
                const res = await response.json();

                if (!res.success || !res.data) {
                    throw new Error(res.error || "Gagal mengambil data analisis.");
                }

                const data = res.data;

                // Save for Detail View (Narrative)
                localStorage.setItem('temp_review_result', data.narrative);

                // --- 3. VISUALIZE RESULT (SPEEDOMETER GAUGE) ---
                const score = data.score || 0;

                // Determine Color (or use backend provided color/category)
                let scoreColor = '#ef4444'; // Red
                if (score >= 80) scoreColor = '#22c55e'; // Green
                else if (score >= 60) scoreColor = '#eab308'; // Yellow
                else if (score >= 40) scoreColor = '#f97316'; // Orange

                // Gauge Calculations (Semi-Circle)
                // We use stroke-dasharray for the arc. The arc path length is exactly PI * radius.
                // Formula: (score / 100) * circumference
                const circumference = Math.PI * 35; // Radius 35
                const dashArray = circumference;
                const dashOffset = circumference - ((score / 100) * circumference);

                // Needle Rotation (0 score = -90deg (left), 100 score = 90deg (right)) -> Total 180 sweep
                // We start with needle pointing UP (0deg), so range is -90 to +90.
                const needleRotation = ((score / 100) * 180) - 90;

                const trend = data.trend || 'Unknown';
                const flow = data.flow || 'Unknown';

                // Safety Check
                const isSafe = !data.narrative.includes("CRITICAL WARNING");

                resultContainer.innerHTML = `
                    <div style="text-align:center; padding: 10px;">
                        <h4 style="margin-bottom:15px; color:${reviewAction === 'BUY' ? '#22c55e' : '#ef4444'}; font-size:1.5rem; letter-spacing: 1px;">
                            ${reviewAction} ${symbol}
                        </h4>
                        
                        <div class="gauge-container" style="position: relative; width: 220px; height: 130px; margin: 0 auto;">
                             <svg class="gauge-svg" viewBox="0 0 100 60" style="width: 100%; height: 100%;">
                                <!-- Background Arc (Grey) -->
                                <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="#334155" stroke-width="8" stroke-linecap="round" />
                                
                                <!-- Progress Arc (Colored) -->
                                <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="${scoreColor}" stroke-width="8" stroke-linecap="round" 
                                      style="stroke-dasharray: ${dashArray}; stroke-dashoffset: ${dashOffset}; transition: stroke-dashoffset 1s ease-out;" />
                                
                                <!-- Needle Group -->
                                <g style="transform-origin: 50px 50px; transform: rotate(${needleRotation}deg); transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1);">
                                    <polygon points="50,15 47,50 53,50" fill="#f8fafc" />
                                    <circle cx="50" cy="50" r="4" fill="#f8fafc" />
                                </g>

                                <!-- Score Text -->
                                <text x="50" y="35" text-anchor="middle" fill="white" font-size="14" font-weight="bold" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">${score}</text>
                                <text x="50" y="58" text-anchor="middle" fill="#94a3b8" font-size="6">SCORE</text>
                             </svg>
                        </div>

                        <div class="review-grid" style="margin-top: 25px; gap: 10px;">
                            <div class="review-badge ${trend.includes('Bull') || trend.includes('Up') ? 'positive' : 'negative'}" style="justify-content: center;">
                                <i class="fas fa-chart-line"></i>
                                <span>${trend}</span>
                            </div>
                            <div class="review-badge ${flow.includes('Accum') || flow.includes('Buyer') ? 'positive' : 'negative'}" style="justify-content: center;">
                                <i class="fas fa-coins"></i>
                                <span>${flow}</span>
                            </div>
                        </div>

                         ${!isSafe ? `
                            <div style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 10px; border-radius: 8px; font-size: 0.8rem; margin-top: 15px; border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-exclamation-triangle"></i> <span>Distribution Detect!</span>
                            </div>
                        ` : ''}
                        
                        <div style="display:flex; gap:10px; margin-top:20px;">
                            <button class="glass-btn btn-retry-review" style="flex:1; padding: 14px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255, 255, 255, 0.05); color: #e2e8f0;">
                                <i class="fas fa-undo"></i> Retry
                            </button>
                            <button class="glass-btn btn-detail-review" style="flex:1.5; padding: 14px; background: #3b82f6; border: none; color: white; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">
                                <i class="fas fa-align-left"></i> See Detail
                            </button>
                        </div>
                    </div>
                `;

                // Re-bind buttons
                const retryBtn = resultContainer.querySelector('.btn-retry-review');
                if (retryBtn) {
                    retryBtn.onclick = () => {
                        document.getElementById('review-result-container').classList.add('hidden');
                        document.getElementById('review-form-body').classList.remove('hidden');
                    };
                }
                const detailBtn = resultContainer.querySelector('.btn-detail-review');
                if (detailBtn) {
                    detailBtn.onclick = () => {
                        window.location.href = `chat.html?mode=review_detail&symbol=${symbol}`;
                    };
                }

            } catch (err) {
                console.error(err);
                // Show Error State
                resultContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">😵</div>
                        <h4 style="color: #ef4444; margin-bottom: 10px;">Analysis Failed</h4>
                        <p style="color: #94a3b8; font-size: 0.9em;">${err.message}</p>
                        <button class="glass-btn btn-retry-review" style="margin-top: 20px; width: 100%;">Try Again</button>
                    </div>
                `;
                const retryBtn = resultContainer.querySelector('.btn-retry-review');
                if (retryBtn) retryBtn.onclick = () => {
                    document.getElementById('review-result-container').classList.add('hidden');
                    document.getElementById('review-form-body').classList.remove('hidden');
                };
            } finally {
                submitReviewBtn.innerText = originalText;
                submitReviewBtn.disabled = false;
            }
        };
    }



    // --- Start Polling ---
    // --- Start Polling (Optimized) ---
    const startPolling = () => {
        if (pollingInterval) clearInterval(pollingInterval);

        // Initial Poll
        loadWatchlist();

        // Check if page is visible
        if (document.visibilityState === 'visible') {
            pollingInterval = setInterval(loadWatchlist, 15000); // 15s active
        }

        // Visibility Change Handler
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Resume
                loadWatchlist(); // Immediate update
                if (pollingInterval) clearInterval(pollingInterval);
                pollingInterval = setInterval(loadWatchlist, 15000);
            } else {
                // Pause
                if (pollingInterval) clearInterval(pollingInterval);
            }
        });
    };


    // --- Updates to Existing Listeners ---
    // Modify existing button listeners to handle Closing the Add Menu if clicked
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // ... existing login ...
            // Add: 
            closeAddMenu();
        });
    });

    if (tickerInput) tickerInput.addEventListener('input', () => { tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)'; });

    // --- QUICK SEARCH LOGIC ---
    const qsInput = document.getElementById('qs-input');
    const qsBtn = document.getElementById('qs-btn');

    if (qsInput && qsBtn) {
        const handleQuickSearch = () => {
            let val = qsInput.value.trim().toUpperCase();
            if (!val) return;

            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

            // Auto-add .JK if 4 chars and no dot
            if (val.length === 4 && !val.includes('.')) {
                val += '.JK';
            }

            // Ensure currentCtxSymbol is set for Feature Menu
            currentCtxSymbol = val;

            qsInput.value = ''; // Clear input
            qsInput.blur(); // Dismiss keyboard

            // Open Context Menu directly
            openContextMenu(val);
        };

        qsBtn.addEventListener('click', handleQuickSearch);

        qsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickSearch();
            }
        });
    }

    // Initial Login & Load
    await login();
    await loadWatchlist();
    fetchMarketSummary(); // Fetch immediately
    startPolling();
});

function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    let confetti = [];
    const colors = ['#fde132', '#009bde', '#ff6b00'];
    for (let i = 0; i < 100; i++) {
        confetti.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height, color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() * 10 + 5, speed: Math.random() * 5 + 2, angle: Math.random() * 6.2 });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        confetti.forEach(c => {
            c.y += c.speed; c.angle += 0.1;
            ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle); ctx.fillStyle = c.color; ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size); ctx.restore();
            if (c.y < canvas.height) active = true;
        });
        if (active) requestAnimationFrame(animate); else canvas.style.display = 'none';
    }
    animate();
}

// --- Helper: Render Real Sparkline SVG Path ---
const renderRealSparkline = (prices) => {
    if (!prices || prices.length === 0) return "M 0 15 L 100 15";

    // 1. Find Min/Max for Scaling
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const distinct = max - min;

    // Dimensions
    const width = 100;
    const height = 30;
    const padding = 2; // Keep line away from exact edge

    // If flat line
    if (distinct === 0) return `M 0 ${height / 2} L ${width} ${height / 2}`;

    // 2. Generate Points
    const step = width / (prices.length - 1);

    const pathOps = prices.map((p, i) => {
        const x = i * step;
        // Invert Y (SVG 0 is top)
        // Normalized: (p - min) / distinct -> 0..1
        // Scale to height: * (height - 2*padding)
        const normalized = (p - min) / distinct;
        const y = height - padding - (normalized * (height - 2 * padding));

        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return pathOps.join(' ');
};
