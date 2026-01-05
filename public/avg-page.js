document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

    if (tg) {
        tg.expand();
        // Set colors according to theme if possible, but theme-engine.js handles CSS
    }

    // --- State & Elements ---
    let urlParams = new URLSearchParams(window.location.search);
    let symbol = urlParams.get('symbol')?.toUpperCase() || '';
    let sessionToken = localStorage.getItem('aston_session_token');

    const initialModal = document.getElementById('initial-modal');
    const initP1 = document.getElementById('init-p1');
    const initL1 = document.getElementById('init-l1');
    const btnContinue = document.getElementById('btn-continue');
    const tickerSwitch = document.getElementById('ticker-switch');

    const outputArea = document.getElementById('output-area');
    const marketPriceEl = document.getElementById('market-price');
    const currentPlEl = document.getElementById('current-pl');
    const currentPlPercentEl = document.getElementById('current-pl-percent');
    const marketInfo = document.getElementById('market-info');

    // Tab Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    let currentMarketPrice = 0;
    let isProGated = false;
    let mainChart, mainCandleSeries;
    let priceLines = { p1: null, p2: null, avg: null, sl: null, tp1: null, tp2: null, tp3: null, ts: null };

    // --- Broker Fees Map ---
    const BROKER_FEE_MAP = {
        ipot: { buy: 0.19, sell: 0.29 },
        stockbit: { buy: 0.1513, sell: 0.2513 },
        most: { buy: 0.18, sell: 0.28 },
        bni: { buy: 0.17, sell: 0.27 },
        trimegah: { buy: 0.18, sell: 0.28 },
        mirae: { buy: 0.15, sell: 0.25 }
    };

    if (tickerSwitch) tickerSwitch.value = symbol;

    const formatIDR = (num) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    };

    const num = (v) => Number(v) || 0;

    const handleCooldown = (data) => {
        if (data && data.error === 'COOLDOWN') {
            const cdOverlay = document.getElementById('cooldown-overlay');
            if (cdOverlay) cdOverlay.classList.remove('hidden');
            return true;
        }
        return false;
    };

    // --- Tab Switching Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');

            // UI Update
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // Scroll to top of card for better UX on mobile
            const inputCard = document.querySelector('.input-card');
            if (inputCard) inputCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        });
    });

    // --- Chart Initialization ---
    const initChart = () => {
        const container = document.getElementById('chart-container');
        if (!container || mainChart) return;

        if (typeof LightweightCharts === 'undefined') {
            const loader = document.getElementById('chart-loading');
            if (loader) loader.innerText = "Error: Library Chart tidak termuat";
            return;
        }

        try {
            mainChart = LightweightCharts.createChart(container, {
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#94a3b8',
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                },
                width: container.clientWidth || 300,
                height: 350,
                crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                timeScale: { timeVisible: true, secondsVisible: false },
            });

            mainCandleSeries = mainChart.addCandlestickSeries({
                upColor: '#22c55e',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#22c55e',
                wickDownColor: '#ef4444',
            });

            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                        if (mainChart) {
                            mainChart.resize(entry.contentRect.width, 350);
                        }
                    }
                }
            });
            resizeObserver.observe(container);
        } catch (e) {
            console.error('[CHART] Initialization failed:', e);
        }
    };

    const fetchCandles = async (sym, interval = '1h') => {
        if (!sym) return false;
        const loader = document.getElementById('chart-loading');
        if (loader) {
            loader.style.display = 'flex';
            loader.innerText = `Loading ${sym}...`;
        }

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'chart', symbol: sym, interval: interval, limit: 100 })
            });

            if (!response.ok) throw new Error('Failed to fetch data');
            const data = await response.json();
            if (handleCooldown(data)) return;

            if (data.success && data.data && data.data.candles) {
                const candles = data.data.candles.map(c => ({
                    time: typeof c.time === 'string' ? Math.floor(new Date(c.time).getTime() / 1000) : c.time,
                    open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close)
                })).sort((a, b) => a.time - b.time);

                if (mainCandleSeries) mainCandleSeries.setData(candles);
                currentMarketPrice = candles[candles.length - 1].close;
                marketPriceEl.innerText = currentMarketPrice.toLocaleString('id-ID');
                marketInfo.innerText = `Realtime Price (${sym})`;

                // Prefill some inputs
                const inpP2 = document.getElementById('inp-p2');
                if (inpP2) inpP2.value = currentMarketPrice;
                const rrEntry = document.getElementById('rr-entry');
                if (rrEntry) rrEntry.value = currentMarketPrice;
                const sizerPrice = document.getElementById('sizer-price');
                if (sizerPrice) sizerPrice.value = currentMarketPrice;

                if (loader) loader.style.display = 'none';

                // Trigger update of real-time stats with new market price
                updateRealtimeStats();
                return true;
            }
        } catch (err) {
            if (loader) loader.innerText = "Error loading chart data.";
        }
        return false;
    };

    const clearPriceLines = () => {
        if (!mainCandleSeries) return;
        Object.keys(priceLines).forEach(key => {
            if (priceLines[key]) {
                try { mainCandleSeries.removePriceLine(priceLines[key]); } catch (e) { }
                priceLines[key] = null;
            }
        });
    };

    const addPriceLine = (price, color, title, style = LightweightCharts.LineStyle.Solid) => {
        if (!mainCandleSeries || !price) return null;
        return mainCandleSeries.createPriceLine({
            price: Number(price),
            color: color,
            lineWidth: 2,
            lineStyle: style,
            axisLabelVisible: true,
            title: title
        });
    };

    // --- Calculation Logic ---
    const updateRealtimeStats = () => {
        const p1 = num(document.getElementById('inp-p1').value);
        const l1 = num(document.getElementById('inp-l1').value);

        // Update top cards
        document.getElementById('val-avg-old').innerText = p1 > 0 ? p1.toLocaleString('id-ID') : '--';
        document.getElementById('val-lot-old').innerText = l1 > 0 ? l1.toLocaleString('id-ID') : '--';

        if (p1 > 0 && l1 > 0 && currentMarketPrice > 0) {
            const currentVal = p1 * l1 * 100;
            const marketVal = currentMarketPrice * l1 * 100;
            const plIDR = marketVal - currentVal;
            const plPct = ((currentMarketPrice - p1) / p1) * 100;

            currentPlEl.innerText = formatIDR(plIDR);
            currentPlEl.className = 'stat-value ' + (plIDR >= 0 ? 'profit' : 'loss');
            currentPlPercentEl.innerText = (plPct >= 0 ? '+' : '') + plPct.toFixed(2) + '%';
            currentPlPercentEl.className = 'stat-sub ' + (plPct >= 0 ? 'profit' : 'loss');
        }

        // Auto-run Average Calculation if enough data
        if (p1 > 0 && l1 > 0) {
            doAvgCalculate();
        }
    };

    // --- Broker Fee Sync Logic ---
    const brokerSelector = document.getElementById('broker-selector');
    if (brokerSelector) {
        brokerSelector.addEventListener('change', (e) => {
            const broker = e.target.value;
            if (broker !== 'custom' && BROKER_FEE_MAP[broker]) {
                const fees = BROKER_FEE_MAP[broker];
                document.getElementById('inp-feebuy').value = fees.buy;
                document.getElementById('inp-feesell').value = fees.sell;

                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

                // Re-calculate average to reflect new fees if possible
                doAvgCalculate();
            }
        });
    }

    // --- Helper: Parse TP Input (Price or %) ---
    const parsePriceOrPct = (input, entry) => {
        if (!input || input.trim() === "") return null;
        let str = input.toString().trim();
        if (str.endsWith('%')) {
            const pct = parseFloat(str.replace('%', '')) / 100;
            const price = entry * (1 + pct);
            return { price: Math.ceil(price), pct: (pct * 100).toFixed(2), isPct: true };
        } else {
            const price = parseFloat(str);
            const pct = ((price - entry) / entry) * 100;
            return { price: Math.ceil(price), pct: pct.toFixed(2), isPct: false };
        }
    };

    // 1. Average Calculator
    const doAvgCalculate = () => {
        const p1 = num(document.getElementById('inp-p1').value);
        const l1 = num(document.getElementById('inp-l1').value);
        const p2 = num(document.getElementById('inp-p2').value);
        const l2Input = num(document.getElementById('inp-l2').value);
        const targetAvg = num(document.getElementById('inp-target').value);
        const slPct = num(document.getElementById('inp-sl').value) / 100;
        const tpPct = num(document.getElementById('inp-tp').value) / 100;

        let resL2 = l2Input;
        if (targetAvg > 0 && targetAvg != p2) {
            // L2 = (L1 * (TargetAvg - P1)) / (P2 - TargetAvg)
            resL2 = Math.ceil((l1 * (targetAvg - p1)) / (p2 - targetAvg));
            if (resL2 < 0) resL2 = 0;
        }

        const totalLot = l1 + resL2;
        const totalInvest = (p1 * l1 * 100) + (p2 * resL2 * 100);
        const avgPrice = totalInvest / (totalLot * 100);

        const slPrice = Math.floor(avgPrice * (1 - slPct));
        const tpPrice = Math.ceil(avgPrice * (1 + tpPct));

        const estLossIDR = (avgPrice - slPrice) * totalLot * 100;
        const estProfitIDR = (tpPrice - avgPrice) * totalLot * 100;

        outputArea.innerHTML = `
            <div class="fade-in">
                <div class="res-row"><span class="res-label">Harga Rata-rata Baru</span><span class="res-value">${avgPrice.toFixed(2)}</span></div>
                <div class="res-row" style="background: rgba(251, 191, 36, 0.1); border: 1px dashed rgba(251, 191, 36, 0.3); border-radius: 8px; margin: 5px 0; padding: 10px;">
                    <span class="res-label" style="color: #fbbf24; font-weight: 700;">LOT BARU HARUS DIBELI</span>
                    <span class="res-value" style="color: #fbbf24; font-weight: 800; font-size: 1.2rem;">${resL2} Lot</span>
                </div>
                <div class="res-row"><span class="res-label">Total Muatan</span><span class="res-value">${totalLot} Lot</span></div>
                <div class="res-row"><span class="res-label">Total Dana Dibutuhkan</span><span class="res-value">${formatIDR(totalInvest)}</span></div>
                <div class="res-row"><span class="res-label">Stop Loss (${(slPct * 100).toFixed(1)}%)</span><span class="res-value loss">${slPrice}</span></div>
                <div class="res-row"><span class="res-label">Target Profit (${(tpPct * 100).toFixed(1)}%)</span><span class="res-value profit">${tpPrice}</span></div>
                <div class="res-row"><span class="res-label">Estimasi Risk (IDR)</span><span class="res-value loss">-${formatIDR(estLossIDR)}</span></div>
                <div class="res-row"><span class="res-label">Estimasi Profit (IDR)</span><span class="res-value profit">${formatIDR(estProfitIDR)}</span></div>
            </div>
        `;

        clearPriceLines();
        priceLines.p1 = addPriceLine(p1, '#3b82f6', 'Harga Lama');
        priceLines.p2 = addPriceLine(p2, '#fbbf24', 'Harga Entry', LightweightCharts.LineStyle.Dashed);
        priceLines.avg = addPriceLine(avgPrice, '#10b981', 'Avg Baru');
        priceLines.sl = addPriceLine(slPrice, '#ef4444', 'SL', LightweightCharts.LineStyle.Dotted);
    };

    // Event listeners for real-time calculation
    ['inp-p1', 'inp-l1', 'inp-p2', 'inp-l2', 'inp-target', 'inp-sl', 'inp-tp'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateRealtimeStats);
    });

    // 2. Position Sizer
    const doSizerCalculate = () => {
        const rawEquity = document.getElementById('sizer-equity').value.replace(/\./g, '');
        const equity = num(rawEquity);
        const riskPct = num(document.getElementById('sizer-risk-pct').value) / 100;
        const slPct = num(document.getElementById('sizer-sl-pct').value) / 100;
        const price = num(document.getElementById('sizer-price').value);

        if (!equity || !price || !slPct) return;

        const amtToRisk = equity * riskPct;
        const riskPerShare = price * slPct;

        // 1. Calculate shares based purely on risk tolerance
        const maxSharesByRisk = Math.floor(amtToRisk / riskPerShare);

        // 2. Calculate shares based on maximum buying power (cash available)
        const maxSharesByEquity = Math.floor(equity / price);

        // 3. Take the minimum (cannot buy more than cash allows)
        const maxShares = Math.min(maxSharesByRisk, maxSharesByEquity);
        const maxLot = Math.floor(maxShares / 100);
        const totalValue = maxLot * 100 * price;

        // Is it limited by capital?
        const isLimitedByCapital = maxSharesByEquity < maxSharesByRisk;

        outputArea.innerHTML = `
            <div class="fade-in">
                <div class="res-row"><span class="res-label">Risk Amount</span><span class="res-value loss">${formatIDR(amtToRisk)}</span></div>
                <div class="res-row" style="background: linear-gradient(90deg, rgba(16, 185, 129, 0.1), transparent); padding: 12px; border-radius: 12px; margin: 15px 0; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <div style="display: flex; flex-direction: column;">
                        <span class="res-label" style="color: #fff; font-size: 0.65rem; margin-bottom: 4px;">MAXIMUM ALLOCATION ${isLimitedByCapital ? '(MAX CAPITAL)' : ''}</span>
                        <span class="res-value" style="font-size: 1.4rem; color: #fbbf24;">${maxLot} LOT</span>
                    </div>
                </div>
                <div class="res-row"><span class="res-label">Total Value</span><span class="res-value">${formatIDR(totalValue)}</span></div>
                <div class="res-row"><span class="res-label">Stop Loss At</span><span class="res-value loss">${Math.floor(price * (1 - slPct))}</span></div>
                ${isLimitedByCapital ? `<div class="res-row" style="margin-top: 10px; opacity: 0.7; font-size: 0.75rem; color: #fbbf24;">⚠️ Alokasi dibatasi oleh total modal Anda.</div>` : ''}
            </div>
        `;

        clearPriceLines();
        priceLines.p1 = addPriceLine(price, '#fbbf24', 'Entry');
        priceLines.sl = addPriceLine(price * (1 - slPct), '#ef4444', 'SL');
    };

    const sizerEquityInp = document.getElementById('sizer-equity');
    if (sizerEquityInp) {
        sizerEquityInp.addEventListener('input', (e) => {
            // Remove non-digits
            let val = e.target.value.replace(/\D/g, "");
            if (val) {
                // Format with dots
                e.target.value = parseInt(val).toLocaleString("id-ID");
            }
            doSizerCalculate();
        });
    }

    // Auto-calculate sizer on other inputs
    ['sizer-risk-pct', 'sizer-sl-pct', 'sizer-price'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', doSizerCalculate);
    });

    // 3. Risk & Reward Manager
    const doRRCalculate = () => {
        const entry = num(document.getElementById('rr-entry').value);
        const sl = num(document.getElementById('rr-sl').value);
        const lot = num(document.getElementById('rr-lot').value);

        const tp1Raw = document.getElementById('rr-tp1-input').value;
        const tp2Raw = document.getElementById('rr-tp2-input').value;
        const tp3Raw = document.getElementById('rr-tp3-input').value;

        const lot1Pct = num(document.getElementById('rr-tp1-lot').value) / 100;
        const lot2Pct = num(document.getElementById('rr-tp2-lot').value) / 100;
        const lot3Pct = num(document.getElementById('rr-tp3-lot').value) / 100;

        if (!entry || !sl || !lot) return alert("Mohon isi Entry, SL, dan Lot");

        const tp1 = parsePriceOrPct(tp1Raw, entry);
        const tp2 = parsePriceOrPct(tp2Raw, entry);
        const tp3 = parsePriceOrPct(tp3Raw, entry);

        if (!tp1) return alert("TP1 harus diisi");

        const riskPerShare = entry - sl;
        const totalRiskIDR = riskPerShare * lot * 100;

        // Lot distribution logic
        let lot1 = 0, lot2 = 0, lot3 = 0;
        if (!tp2 && !tp3) {
            lot1 = lot;
        } else if (!tp3) {
            lot1 = Math.floor(lot * (lot1Pct / (lot1Pct + lot2Pct)));
            lot2 = lot - lot1;
        } else {
            lot1 = Math.floor(lot * lot1Pct);
            lot2 = Math.floor(lot * lot2Pct);
            lot3 = lot - lot1 - lot2;
        }

        const profit1 = (tp1.price - entry) * lot1 * 100;
        const profit2 = tp2 ? (tp2.price - entry) * lot2 * 100 : 0;
        const profit3 = tp3 ? (tp3.price - entry) * lot3 * 100 : 0;
        const totalProfit = profit1 + profit2 + profit3;

        let outputHtml = `
            <div class="fade-in">
                <div class="res-row"><span class="res-label">Total Risk (Equity)</span><span class="res-value loss">-${formatIDR(Math.abs(totalRiskIDR))}</span></div>
                <div class="res-row"><span class="res-label">Potential Total Profit</span><span class="res-value profit">${formatIDR(totalProfit)}</span></div>
                <div class="res-row"><span class="res-label">RR Ratio Avg</span><span class="res-value">${(totalProfit / Math.abs(totalRiskIDR || 1)).toFixed(2)}</span></div>
                <hr style="opacity: 0.1; margin: 10px 0;">
                <div class="res-row"><span class="res-label">TP 1 (${tp1.price}) [${tp1.pct}%]</span><span class="res-value profit">${lot1} Lot | ${formatIDR(profit1)}</span></div>
        `;

        if (tp2) {
            outputHtml += `<div class="res-row"><span class="res-label">TP 2 (${tp2.price}) [${tp2.pct}%]</span><span class="res-value profit">${lot2} Lot | ${formatIDR(profit2)}</span></div>`;
        }
        if (tp3) {
            outputHtml += `<div class="res-row"><span class="res-label">TP 3 (${tp3.price}) [${tp3.pct}%]</span><span class="res-value profit">${lot3} Lot | ${formatIDR(profit3)}</span></div>`;
        }

        outputHtml += `</div>`;
        outputArea.innerHTML = outputHtml;

        clearPriceLines();
        priceLines.p1 = addPriceLine(entry, '#fbbf24', 'Entry');
        priceLines.sl = addPriceLine(sl, '#ef4444', 'SL');
        priceLines.tp1 = addPriceLine(tp1.price, '#10b981', 'TP1');
        if (tp2) priceLines.tp2 = addPriceLine(tp2.price, '#059669', 'TP2');
        if (tp3) priceLines.tp3 = addPriceLine(tp3.price, '#064e3b', 'TP3');
    };

    // 4. Trailing Stop Advisor
    const doTSCalculate = () => {
        const entry = num(document.getElementById('ts-entry').value);
        const high = num(document.getElementById('ts-high').value);
        const tsPct = num(document.getElementById('ts-pct').value) / 100;

        if (!entry || !high) return alert("Harap isi Entry dan Harga Tertinggi");

        const currentProfitIDR = (high - entry) * 100; // per lot unit
        const currentProfitPct = ((high - entry) / entry) * 100;

        const tsPrice = Math.floor(high * (1 - tsPct));
        const stopProfitIDR = (tsPrice - entry) * 100;
        const profitLockPct = ((tsPrice - entry) / entry) * 100;

        outputArea.innerHTML = `
            <div class="fade-in">
                <div class="res-row"><span class="res-label">Current Floating Profit</span><span class="res-value profit">+${currentProfitPct.toFixed(2)}%</span></div>
                <div class="res-row" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; margin: 15px 0; padding: 15px;">
                    <span class="res-label" style="display: block; font-size: 0.7rem; color: #94a3b8; margin-bottom: 5px;">PROTECTION LEVEL (TS)</span>
                    <span class="res-value" style="font-size: 1.6rem; color: #10b981; font-weight: 800;">${tsPrice}</span>
                    <div style="font-size: 0.75rem; color: #fff; margin-top: 5px; opacity: 0.8;">
                        Profit Dikunci pada: <span style="color: #fbbf24; font-weight: 700;">+${profitLockPct.toFixed(2)}%</span>
                    </div>
                </div>
                <div class="res-row"><span class="res-label">Buffer dari High</span><span class="res-value" style="color:#ef4444;">-${(tsPct * 100).toFixed(0)}%</span></div>
                <p style="font-size: 0.75rem; opacity: 0.6; margin-top: 15px; font-style: italic;">
                    "Jual posisi Anda jika harga turun menembus ${tsPrice} untuk mengamankan keuntungan."
                </p>
            </div>
        `;

        clearPriceLines();
        priceLines.p1 = addPriceLine(entry, '#fbbf24', 'Entry');
        priceLines.p2 = addPriceLine(high, '#fa3a3aff', 'High', LightweightCharts.LineStyle.Dashed);
        priceLines.ts = addPriceLine(tsPrice, '#10b981', 'Trailing Stop');
    };

    // Chip logic for TS
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.parentElement;
            parent.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('ts-pct').value = btn.getAttribute('data-val');
            doTSCalculate();
        });
    });

    // Global Calculation Router
    document.querySelectorAll('.btn-calculate').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-calc');
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

            switch (type) {
                case 'avg': doAvgCalculate(); break;
                case 'sizer': doSizerCalculate(); break;
                case 'rr': doRRCalculate(); break;
                case 'ts': doTSCalculate(); break;
            }
        });
    });

    // --- Switch Symbol Support ---
    const switchSymbol = async (newSym) => {
        if (!newSym) return;
        symbol = newSym.toUpperCase();
        tickerSwitch.value = symbol;
        await fetchCandles(symbol);
        outputArea.innerHTML = '<div style="text-align: center; opacity: 0.4; padding: 40px 0;">Ticker Switched. Input details below.</div>';
    };

    tickerSwitch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') switchSymbol(tickerSwitch.value.trim());
    });

    document.getElementById('btn-switch-go')?.addEventListener('click', () => {
        switchSymbol(tickerSwitch.value.trim());
    });

    // Initial Setup Modal
    btnContinue.addEventListener('click', async () => {
        const p1 = initP1.value;
        const l1 = initL1.value;
        if (!p1 || !l1) return alert('Harap isi data posisi anda.');

        document.getElementById('inp-p1').value = p1;
        document.getElementById('inp-l1').value = l1;
        document.getElementById('rr-lot').value = l1;

        initialModal.style.display = 'none';

        if (!symbol) symbol = tickerSwitch.value.trim().toUpperCase();
        if (symbol) await fetchCandles(symbol);

        // Auto-run stats and AVG initially
        updateRealtimeStats();
    });

    initChart();
    if (!symbol) {
        initialModal.style.display = 'flex';
    } else {
        // Just pre-fetch if we have sym
        fetchCandles(symbol);
    }
});
