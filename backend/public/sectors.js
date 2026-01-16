document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    if (tg) tg.expand();

    const sessionToken = localStorage.getItem('aston_session_token');
    const loadingScreen = document.getElementById('loading-screen');
    const heatmapGrid = document.getElementById('heatmap-grid');
    const updateInfo = document.getElementById('update-info');

    if (!sessionToken) {
        window.location.href = 'index.html';
        return;
    }

    const getIntensityClass = (change) => {
        if (change >= 1.5) return 'heat-bull-3';
        if (change >= 0.8) return 'heat-bull-2';
        if (change > 0.1) return 'heat-bull-1';
        if (change <= -1.5) return 'heat-bear-3';
        if (change <= -0.8) return 'heat-bear-2';
        if (change < -0.1) return 'heat-bear-1';
        return 'heat-neutral';
    };

    const handleCooldown = (data) => {
        if (data && data.error === 'COOLDOWN') {
            const cdOverlay = document.getElementById('cooldown-overlay');
            if (cdOverlay) {
                cdOverlay.classList.remove('hidden');
            }
            return true;
        }
        return false;
    };

    const fetchSectors = async () => {
        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ action: 'sectors' })
            });

            const data = await response.json();
            if (handleCooldown(data)) {
                loadingScreen.style.display = 'none';
                return;
            }

            if (data.success) {
                renderHeatmap(data.data);
                const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                updateInfo.innerText = `Terakhir diperbarui: ${timeStr} WIB (Yahoo Finance Data)`;

                // Hide loading
                loadingScreen.style.opacity = '0';
                setTimeout(() => loadingScreen.style.display = 'none', 500);
            } else {
                throw new Error(data.error || 'Failed to fetch');
            }
        } catch (err) {
            console.error('Heatmap Error:', err);
            updateInfo.innerText = '❌ Gagal memuat data. Periksa koneksi atau status PRO.';
            updateInfo.style.color = '#f87171';
            loadingScreen.style.display = 'none';
        }
    };

    const renderHeatmap = (sectors) => {
        heatmapGrid.innerHTML = '';

        sectors.forEach(s => {
            const intensity = getIntensityClass(s.changePercent);
            const card = document.createElement('div');
            card.className = `sector-card ${intensity}`;

            const sign = s.changePercent >= 0 ? '+' : '';

            card.innerHTML = `
                <div class="sector-name">${s.name}</div>
                <div class="sector-change">${sign}${s.changePercent.toFixed(2)}%</div>
                <div class="sector-price">${s.price.toLocaleString('id-ID')}</div>
            `;

            card.onclick = () => {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                showSectorEmitents(s.name);
            };

            heatmapGrid.appendChild(card);
        });
    };

    // Modal Logic
    const sectorModal = document.getElementById('sector-modal');
    const closeModal = document.getElementById('close-modal');
    const modalSectorName = document.getElementById('modal-sector-name');
    const emitentList = document.getElementById('emitent-list');
    const modalLoading = document.getElementById('modal-loading');

    const showSectorEmitents = async (sectorName) => {
        modalSectorName.innerText = sectorName;
        emitentList.innerHTML = '';
        modalLoading.style.display = 'flex';
        sectorModal.classList.add('active');

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ action: 'sector-emitents', sector: sectorName })
            });

            const data = await response.json();
            if (handleCooldown(data)) {
                sectorModal.classList.remove('active');
                return;
            }

            if (data.success) {
                renderEmitents(data.data);
            } else {
                throw new Error(data.error || 'Failed to fetch emiten list');
            }
        } catch (err) {
            console.error('Modal Error:', err);
            emitentList.innerHTML = `<p style="text-align: center; opacity: 0.6; padding: 20px;">❌ Gagal memuat data emiten.</p>`;
        } finally {
            modalLoading.style.display = 'none';
        }
    };

    const renderEmitents = (emitents) => {
        emitentList.innerHTML = '';
        if (!emitents || emitents.length === 0) {
            emitentList.innerHTML = `<p style="text-align: center; opacity: 0.6; padding: 20px;">Tidak ada emiten ditemukan.</p>`;
            return;
        }

        emitents.forEach(e => {
            const item = document.createElement('a');
            item.className = 'emitent-item';
            // Link to chart page with symbol
            item.href = `chart.html?symbol=${e.symbol}`;

            const changeClass = e.change > 0 ? 'change-up' : (e.change < 0 ? 'change-down' : 'change-neutral');
            const sign = e.change > 0 ? '+' : '';

            item.innerHTML = `
                <div class="emitent-info">
                    <span class="emitent-symbol">${e.symbol}</span>
                    <span class="emitent-name">${e.name}</span>
                </div>
                <div class="emitent-price-box">
                    <div class="emitent-price">${e.price.toLocaleString('id-ID')}</div>
                    <div class="emitent-change ${changeClass}">${sign}${e.change.toFixed(2)}%</div>
                </div>
            `;

            item.onclick = (event) => {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            };

            emitentList.appendChild(item);
        });
    };

    closeModal.onclick = () => {
        sectorModal.classList.remove('active');
    };

    // Close when clicking outside
    window.onclick = (event) => {
        if (event.target === sectorModal) {
            sectorModal.classList.remove('active');
        }
    };

    // Initial Fetch
    fetchSectors();
});
