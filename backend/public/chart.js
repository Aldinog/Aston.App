// Global Variables
let chart, candlestickSeries;
let currentMode = 'analysis'; // 'analysis' or 'clear'
let autoSeries = []; // Store S/R and Trendline series for easy clearing
let lastMarkers = []; // Cache markers for toggling
let manualSeriesRef = [];
let lastResponseData = null;
let crosshairPosition = null;

// Live Mode Variables
let liveInterval = null;
let isLiveMode = false;
let currentInterval = '1d';
let lastBarTime = 0;

// Get URL Params
const urlParams = new URLSearchParams(window.location.search);
let currentSymbol = urlParams.get('symbol') || 'BBCA';
const tickerInput = document.getElementById('ticker-switch');
if (tickerInput) tickerInput.value = currentSymbol;

// Initialization
try {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) throw new Error('Chart Container not found');

    chart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { type: 'solid', color: '#0f172a' },
            textColor: '#94a3b8',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
    });

    // Resize Handler
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                if (chart) {
                    chart.resize(entry.contentRect.width, entry.contentRect.height);
                    chart.timeScale().fitContent();
                }
            }
        }
    });
    resizeObserver.observe(chartContainer);

    // Controls Logic
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // --- LIMIT CHECK ---
            const interval = btn.dataset.interval;
            try {
                const cachedUser = localStorage.getItem('cached_user_data');
                if (cachedUser) {
                    const user = JSON.parse(cachedUser);
                    // Check if Limit Chart Mode is ON (default true if not set, or specific flag)
                    // We assume it exists in user object or global config. Use 'paywall_mode' as proxy or specific 'limit_chart_mode' if available.
                    // Based on previous files, 'paywall_mode' seems to be the main toggle for features.
                    const isPaywall = user.paywall_mode || false;
                    const isStandard = (user.membership_status || 'standard') === 'standard';

                    if (isPaywall && isStandard && interval !== '1d') {
                        // Show Overlay
                        const pwOverlay = document.getElementById('paywall-overlay');
                        if (pwOverlay) pwOverlay.classList.remove('hidden');
                        return; // Stop execution
                    }
                }
            } catch (e) { console.warn('Limit check failed', e); }

            timeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadData(btn.dataset.interval);
        });
    });

    // Mode Toggle Logic (Unified Button)
    const btnToggle = document.getElementById('btn-mode-toggle');

    btnToggle.addEventListener('click', () => {
        if (currentMode === 'analysis') {
            // Switch to Clear Mode
            currentMode = 'clear';
            btnToggle.innerText = 'Analysis';
            btnToggle.classList.remove('mode-analysis');
            btnToggle.classList.add('mode-clear');
            clearAutoFeatures();
        } else {
            // Switch to Analysis Mode
            currentMode = 'analysis';
            btnToggle.innerText = 'Clear';
            btnToggle.classList.remove('mode-clear');
            btnToggle.classList.add('mode-analysis');
            renderAutoFeatures(lastResponseData);
            if (candlestickSeries && lastMarkers) {
                candlestickSeries.setMarkers(lastMarkers);
            }
        }
    });

    // Start Data Load
    loadData('1d');

    // Ticker Switch Logic
    if (tickerInput) {
        tickerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                switchSymbol(tickerInput.value);
                tickerInput.blur();
            }
        });

        // Auto-select text on click for faster typing
        tickerInput.addEventListener('click', () => {
            tickerInput.select();
        });

        tickerInput.value = currentSymbol;
    }

} catch (e) {
    console.error(e);
}

/**
 * Helper to convert Lightweight Charts time to numerical timestamp
 */
function toTimestamp(time) {
    if (typeof time === 'number') return time;
    if (typeof time === 'string') return new Date(time).getTime() / 1000;
    if (time && time.year) return new Date(time.year, time.month - 1, time.day).getTime() / 1000;
    return 0;
}

function handleCooldown(data) {
    if (data && data.error === 'COOLDOWN') {
        const cdOverlay = document.getElementById('cooldown-overlay');
        if (cdOverlay) cdOverlay.classList.remove('hidden');
        return true;
    }
    return false;
}


// Global so we can re-render on mode switch
// (declared at top)

async function switchSymbol(newSymbol) {
    if (!newSymbol) return;
    const cleanSymbol = newSymbol.toUpperCase().trim();
    if (cleanSymbol === currentSymbol) return;

    console.log(`[SWITCH] Switching from ${currentSymbol} to ${cleanSymbol}`);
    currentSymbol = cleanSymbol;
    const tickerInput = document.getElementById('ticker-switch');
    if (tickerInput) tickerInput.value = currentSymbol;

    // Reset company name to loading
    const companyTitle = document.getElementById('company-title');
    if (companyTitle) companyTitle.innerText = 'Loading...';

    // Sync Timeframe Buttons (Switching symbol always defaults to 1d)
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
        if (btn.dataset.interval === '1d') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Clear existing data and features immediately for better UX
    if (candlestickSeries) candlestickSeries.setData([]);
    lastBarTime = 0;
    clearAutoFeatures();

    // Trigger data load
    await loadData('1d');
    currentInterval = '1d';

    // Update URL without refresh (optional, good for bookmarking)
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('symbol', currentSymbol);
    window.history.pushState({}, '', newUrl);
}

// Load Data Function
async function loadData(interval) {
    const spinner = document.getElementById('loading-spinner');
    const spinnerText = spinner.querySelector('span');
    if (spinnerText) spinnerText.innerText = 'Fetching Market Data...';

    spinner.style.display = 'flex';
    spinner.style.opacity = '1';

    if (candlestickSeries) {
        // Don't clear data/markers yet for blurred background effect
        // candlestickSeries.setData([]); 
        // candlestickSeries.setMarkers([]);
    }
    clearAutoFeatures();

    const token = localStorage.getItem('aston_session_token');

    try {
        const response = await fetch('/api/web', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'chart',
                symbol: currentSymbol,
                interval: interval
            })
        });

        currentInterval = interval;

        // Handle 403 (Limit) from Backend
        if (response.status === 403) {
            const res = await response.json();
            // Check if it's the limit error
            if (res.error && res.error.includes('Limit Timeframe')) {
                const pwOverlay = document.getElementById('paywall-overlay');
                if (pwOverlay) pwOverlay.classList.remove('hidden');

                // Revert UI to D1 if possible, or just stop spinner
                stopLiveUpdates();
                if (spinnerText) spinnerText.innerText = 'Access Denied';
            } else {
                if (spinnerText) spinnerText.innerText = res.error || 'Access Denied';
            }
            return; // Stop execution
        }

        const res = await response.json();
        if (handleCooldown(res)) return;

        if (res.success && res.data) {
            // Check Live Eligibility
            if (res.is_live_eligible) {
                startLiveUpdates();
            } else {
                stopLiveUpdates();
            }
            lastResponseData = res.data;
            if (spinnerText) spinnerText.innerText = 'Generating Signals...';
            const { candles, markers, levels, trendlines, companyName } = res.data;

            const tickerInput = document.getElementById('ticker-switch');
            if (tickerInput) tickerInput.value = currentSymbol;

            const companyTitle = document.getElementById('company-title');
            if (companyTitle) companyTitle.innerText = companyName || currentSymbol;

            if (candles.length === 0) {
                if (spinnerText) spinnerText.innerText = 'No Data Found';
                return;
            }

            // Validating Data
            const uniqueCandles = [];
            const times = new Set();

            const sorted = candles.sort((a, b) => {
                const tA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
                const tB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
                return tA - tB;
            });

            sorted.forEach(c => {
                if (!times.has(c.time)) {
                    times.add(c.time);
                    uniqueCandles.push(c);
                }
            });

            if (candlestickSeries) {
                candlestickSeries.setData(uniqueCandles);

                // Track last bar time for live updates safety
                if (uniqueCandles.length > 0) {
                    const last = uniqueCandles[uniqueCandles.length - 1];
                    lastBarTime = toTimestamp(last.time);
                }

                // Force price scale to auto-scale to new data
                candlestickSeries.priceScale().applyOptions({
                    autoScale: true,
                });

                const validMarkers = (markers || []).filter(m => times.has(m.time)).sort((a, b) => {
                    const tA = toTimestamp(a.time);
                    const tB = toTimestamp(b.time);
                    return tA - tB;
                });
                lastMarkers = validMarkers;

                if (candlestickSeries) {
                    candlestickSeries.setMarkers(validMarkers);
                }
            }

            if (currentMode === 'analysis') {
                renderAutoFeatures(res.data);
            } else {
                clearAutoFeatures();
            }

            if (chart) {
                // Focus on recent data (last 50-60 bars) for better zoom on open
                const totalCandles = uniqueCandles.length;
                if (totalCandles > 0) {
                    chart.timeScale().setVisibleLogicalRange({
                        from: totalCandles - 50,
                        to: totalCandles,
                    });
                }
            }
        } else {
            stopLiveUpdates();
            if (spinnerText) spinnerText.innerText = 'API Error';
            console.error(res.error);
        }

    } catch (err) {
        stopLiveUpdates();
        if (spinnerText) spinnerText.innerText = 'Network Error';
        console.error(err);
    } finally {
        spinner.style.opacity = '0';
        setTimeout(() => {
            spinner.style.display = 'none';
        }, 300);
    }
}

/**
 * AUTO MODE RENDERING
 */
function renderAutoFeatures(data) {
    if (!data) return;
    clearAutoFeatures();

    const { levels, trendlines } = data;

    // Render S/R Levels
    if (levels) {
        levels.forEach(level => {
            const priceLine = candlestickSeries.createPriceLine({
                price: level.price,
                color: level.type === 'support' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: level.type.toUpperCase(),
            });
            autoSeries.push({ type: 'priceLine', ref: priceLine });
        });
    }

    // Render Trendlines
    if (trendlines) {
        trendlines.forEach(line => {
            const series = chart.addLineSeries({
                color: line.type === 'support' ? '#22c55e' : '#ef4444',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                lastValueVisible: false,
                priceLineVisible: false,
            });
            series.setData([
                { time: line.p1.time, value: line.p1.price },
                { time: line.p2.time, value: line.p2.price }
            ]);
            autoSeries.push({ type: 'series', ref: series });
        });
    }
}

function clearAutoFeatures() {
    autoSeries.forEach(item => {
        if (item.type === 'priceLine') {
            candlestickSeries.removePriceLine(item.ref);
        } else if (item.type === 'series') {
            chart.removeSeries(item.ref);
        }
    });
    autoSeries = [];
}

function clearManualFromChart() {
    manualSeriesRef.forEach(item => {
        if (item.type === 'priceLine') {
            candlestickSeries.removePriceLine(item.ref);
        } else if (item.type === 'series') {
            chart.removeSeries(item.ref);
        }
    });
    manualSeriesRef = [];
}

/**
 * LIVE UPDATES LOGIC
 */
function startLiveUpdates() {
    if (liveInterval) clearInterval(liveInterval);
    isLiveMode = true;

    console.log(`[LIVE] Starting real-time updates for ${currentSymbol} (${currentInterval})`);

    liveInterval = setInterval(async () => {
        if (!isLiveMode) return;

        const token = localStorage.getItem('aston_session_token');
        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'live-quote',
                    symbol: currentSymbol,
                    interval: currentInterval
                })
            });

            const res = await response.json();
            if (handleCooldown(res)) {
                stopLiveUpdates();
                return;
            }
            if (res.success && res.data) {
                const quote = res.data;
                // Update the last candle
                if (candlestickSeries) {
                    // Safety check: Lightweight Charts throws if time < last existing time
                    const incomingTime = toTimestamp(quote.time);
                    if (incomingTime >= lastBarTime) {
                        candlestickSeries.update(quote);
                        lastBarTime = incomingTime;
                        console.log(`[LIVE] Update: ${quote.time} Close: ${quote.close}`);
                    } else {
                        console.warn(`[LIVE] Ignored older data: ${quote.time} (Current: ${lastBarTime})`);
                    }
                }
            }
        } catch (e) {
            console.error('[LIVE] Polling Error:', e);
        }
    }, 10000); // 10 seconds polling
}

function stopLiveUpdates() {
    isLiveMode = false;
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
        console.log('[LIVE] Stopped updates');
    }
}

// Clean up on page leave
window.addEventListener('beforeunload', stopLiveUpdates);
