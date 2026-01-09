const { fetchHarga } = require('../../src/utils/harga');
const { analyzeStock } = require('../../src/utils/analisys');
const { analyzeWithAI } = require('../../src/utils/ai');
const {
    fetchHistorical,
    analyzeProxyBrokerActivity,
    formatProxyBrokerActivity,
    fetchFundamentals,
    formatFundamentals,
    fetchProfile,
    formatProfile,
    fetchSectors
} = require('../../src/utils/yahoofinance');
const { getPersistentCandles } = require('../../src/utils/persistence');
const { computeIndicators, formatIndicatorsForPrompt } = require('../../src/utils/indicators');
const { calculateAvg, formatAvgReport } = require('../../src/utils/avg');
const { markdownToTelegramHTML } = require('../../src/utils/telegram');
const { supabase } = require('../../src/utils/supabase');

// Cache for live quotes to prevent hitting Yahoo Finance too often
const quoteCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Cache for Sector Heatmap
let sectorsCache = null;
let sectorsCacheTime = 0;
const SECTOR_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Cache for Sector Emitents (per sector)
const sectorEmitentsCache = new Map();
const SECTOR_EMITENTS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Dynamic import helper for marked
let marked;
async function loadMarked() {
    if (!marked) marked = (await import("marked")).marked;
    return marked;
}

async function handleMarketAction(req, res, action, user, activeTheme, liveModeWhitelist, limitConfig = {}) {
    const { symbol } = req.body;
    const { limitChartMode = true, limitAIMode = true, limitAICount = 5 } = limitConfig;

    // --- Helper: Check & Update Usage ---
    async function checkDailyUsage(user, type, maxLimit) {
        if (user.membership_status === 'pro') return true; // PRO unlimited

        const today = new Date().toISOString().split('T')[0];
        let usage = user.daily_usage || {}; // Expect JSONB: { date: "2024-01-01", ai_count: 0 }

        // Reset if new day
        if (usage.date !== today) {
            usage = { date: today, ai_count: 0 };
        }

        if (type === 'ai') {
            if (usage.ai_count >= maxLimit) return false;
            usage.ai_count++;
        }

        // Update DB
        // Note: This is async and "fire and forget" or await depending on strictness.
        // We await to be safe.
        try {
            await supabase.from('users').update({ daily_usage: usage }).eq('id', user.id);
            user.daily_usage = usage; // Update local obj
            return true;
        } catch (e) {
            console.error('Failed to update usage:', e);
            return true; // Fail open if DB error?
        }
    }

    let result = '';

    const actionsWithoutSymbol = ['sectors', 'sector-emitents'];
    if (!symbol && !actionsWithoutSymbol.includes(action)) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    switch (action) {
        case 'price': // Replaced by Profile
        case 'profile':
            const profileData = await fetchProfile(symbol);
            result = formatProfile(profileData);
            break;

        case 'fundamental':
            const fundData = await fetchFundamentals(symbol);
            if (!fundData) {
                result = "❌ Data fundamental tidak ditemukan.";
            } else {
                return res.status(200).json({
                    success: true,
                    data: fundData,
                    formatted: formatFundamentals(fundData),
                    active_theme: activeTheme
                });
            }
            break;

        case 'quote':
            const { fetchQuote } = require('../../src/utils/yahoofinance');
            let syms = symbol;
            if (typeof symbol === 'string' && symbol.includes(',')) {
                syms = symbol.split(',').map(s => s.trim());
            }
            const dict = await fetchQuote(syms);
            return res.status(200).json({
                success: true,
                data: dict
            });

        case 'indicators':
            const analysis = await analyzeStock(symbol);
            result = analysis.text || analysis.error;
            break;

        case 'analysis':
            // Safeguard: Ensure IDX symbol has .JK
            let targetAnalysisSym = symbol;
            if (targetAnalysisSym && !targetAnalysisSym.includes('.') && /^[A-Z]{4}$/.test(targetAnalysisSym)) {
                targetAnalysisSym = `${targetAnalysisSym}.JK`;
            }

            // --- AI LIMIT CHECK ---
            if (limitAIMode) {
                const allowed = await checkDailyUsage(user, 'ai', limitAICount);
                if (!allowed) {
                    return res.status(403).json({ error: `Limit Harian AI Tercapai (${limitAICount}x). Upgrade ke PRO untuk Unlimited.` });
                }
            }

            const candles = await getPersistentCandles(targetAnalysisSym, '1d', 50);
            if (!candles || candles.length === 0) {
                result = `❌ Data ${targetAnalysisSym} tidak tersedia (Candles Null).`;
            } else {
                const indicators = computeIndicators(candles);
                const prompt = formatIndicatorsForPrompt(targetAnalysisSym, indicators);
                result = await analyzeWithAI(prompt);
            }
            break;

        case 'proxy':
            const candlesProxy = await getPersistentCandles(symbol, '1d', 120);
            const activity = analyzeProxyBrokerActivity(candlesProxy);
            result = formatProxyBrokerActivity(symbol, activity);
            break;

        case 'chart':
            const { getChartData } = require('../../src/utils/charting');
            const interval = req.body.interval || '1d';
            const limit = req.body.limit || 300;
            console.log(`[API] Processing chart request for ${symbol} interval ${interval} limit ${limit}`);

            // --- CHART LIMIT CHECK for Standard Users ---
            if (limitChartMode && user.membership_status !== 'pro') {
                const allowedIntervals = ['1d', 'd1'];
                if (!allowedIntervals.includes(interval.toLowerCase())) {
                    return res.status(403).json({ error: 'Limit Timeframe (D1 Only). Upgrade PRO untuk Intraday.' });
                }
            }

            try {
                const chartData = await getChartData(symbol, interval, limit);
                console.log(`[API] Returning chart data: ${chartData.candles.length} candles, ${chartData.markers.length} markers`);

                // OPEN ACCESS: All users are now eligible for live charts thanks to Smart Queue
                const isLiveEligible = true;

                return res.status(200).json({
                    success: true,
                    data: chartData,
                    is_live_eligible: isLiveEligible
                });
            } catch (error) {
                console.error(`[API] Chart Error:`, error);
                return res.status(500).json({ success: false, error: error.message });
            }

        case 'live-quote':
            const intervalLive = req.body.interval || '1d';
            const liveCacheKey = `${symbol}_${intervalLive}`;
            const cachedBody = quoteCache.get(liveCacheKey);

            if (cachedBody && (Date.now() - cachedBody.timestamp < CACHE_TTL)) {
                console.log(`[LIVE API] Cache Hit for ${liveCacheKey}`);
                return res.status(200).json({ success: true, data: cachedBody.data });
            }

            try {
                const { fetchHistorical } = require('../../src/utils/yahoofinance');
                const liveCandles = await fetchHistorical(symbol, { interval: intervalLive, limit: 2, forceRefresh: true });

                if (liveCandles && liveCandles.length > 0) {
                    const lastCandle = liveCandles[liveCandles.length - 1];
                    quoteCache.set(liveCacheKey, {
                        timestamp: Date.now(),
                        data: lastCandle
                    });
                    return res.status(200).json({ success: true, data: lastCandle });
                } else {
                    return res.status(404).json({ success: false, error: 'No quote data' });
                }
            } catch (error) {
                console.error(`[LIVE API] Error:`, error);
                return res.status(500).json({ success: false, error: error.message });
            }

        case 'signal':
            // --- AI LIMIT CHECK ---
            if (limitAIMode) {
                const allowed = await checkDailyUsage(user, 'ai', 5);
                if (!allowed) {
                    return res.status(403).json({ error: 'Limit Harian Signal AI Tercapai (5x). Upgrade ke PRO untuk Unlimited.' });
                }
            }

            const { generateSignal } = await import('../../src/utils/signal.js');
            result = await generateSignal(symbol);
            break;

        case 'review':
            // --- AI LIMIT CHECK ---
            if (limitAIMode) {
                const allowed = await checkDailyUsage(user, 'ai', 5);
                if (!allowed) {
                    return res.status(403).json({ error: 'Limit Harian Review Tercapai (5x). Upgrade ke PRO untuk Unlimited.' });
                }
            }

            const { generateReview } = await import('../../src/utils/review.js');
            const { entry, sl, mode } = req.body;
            if (!entry || !mode) {
                return res.status(400).json({ error: "❌ Data entry dan action (BUY/SELL) wajib diisi." });
            } else {
                const reviewResult = await generateReview(mode, symbol, entry, sl);
                return res.status(200).json({
                    success: true,
                    data: reviewResult,
                    active_theme: activeTheme
                });
            }
            break;

        case 'avg':
            const { p1, l1, p2, targetAvg, l2Input, slPercent, tpPercent, feeBuy, feeSell } = req.body;
            if (!p1 || !l1) {
                result = "❌ Data harga beli lama dan jumlah lot wajib diisi.";
            } else {
                let finalP2 = p2;
                let currentPrice = null;
                try {
                    const priceData = await fetchHarga(symbol);
                    const candles = await fetchHistorical(symbol, { limit: 1 });
                    if (candles && candles.length > 0) {
                        currentPrice = candles[0].close;
                        if (!finalP2) finalP2 = currentPrice;
                    }
                } catch (e) {
                    console.error("Price fetch failed for avg calculator:", e);
                }

                if (!finalP2) {
                    return res.json({ success: false, error: 'Harga beli baru (P2) tidak ditemukan dan tidak diisi secara manual.' });
                } else {
                    const avgData = calculateAvg({
                        symbol,
                        p1: Number(p1),
                        l1: Number(l1),
                        p2: Number(finalP2),
                        targetAvg: targetAvg ? Number(targetAvg) : null,
                        l2Input: l2Input ? Number(l2Input) : null,
                        currentPrice: currentPrice,
                        slPercent,
                        tpPercent,
                        feeBuy,
                        feeSell
                    });
                    try {
                        let reportHtml = await markdownToTelegramHTML(formatAvgReport(avgData));
                        reportHtml = reportHtml.replace(/\n/g, '<br>');

                        return res.json({
                            success: true,
                            data: reportHtml,
                            raw: avgData,
                            active_theme: activeTheme
                        });
                    } catch (genErr) {
                        console.error("Report generation failed:", genErr);
                        return res.json({
                            success: true,
                            data: `<b>Simulasi Selesai</b><br>Kalkulasi berhasil tetapi gagal membangun laporan teks. Cek grafik untuk visualisasi detail.`,
                            raw: avgData,
                            active_theme: activeTheme
                        });
                    }
                }
            }
            break;

        case 'sector-emitents':
            const { sector } = req.body;
            if (!sector) return res.status(400).json({ error: 'Sector name required' });

            const cachedEmitents = sectorEmitentsCache.get(sector);
            if (cachedEmitents && (Date.now() - cachedEmitents.timestamp < SECTOR_EMITENTS_CACHE_TTL)) {
                console.log(`[CACHE HIT] Sector Emitents for ${sector}`);
                return res.json({
                    success: true,
                    sector: sector,
                    data: cachedEmitents.data,
                    cached: true
                });
            }

            console.log(`[CACHE MISS] Fetching Sector Emitents for ${sector}...`);
            const sectorMapping = {
                'Energy': ['Energy'],
                'Basic Materials': ['Basic Materials'],
                'Industrials': ['Industrials'],
                'Consumer Cyclicals': ['Consumer Cyclical'],
                'Consumer Non-Cyclicals': ['Consumer Defensive'],
                'Healthcare': ['Healthcare'],
                'Financials': ['Financial Services'],
                'Properties': ['Real Estate'],
                'Technology': ['Technology'],
                'Infrastructures': ['Communication Services', 'Utilities'],
                'Logistics': ['Industrials']
            };

            const curatedTickers = {
                'Energy': ['ADRO', 'ITMG', 'PTBA', 'PGAS', 'MEDC', 'AKRA'],
                'Basic Materials': ['TPIA', 'MDKA', 'INCO', 'ANTM', 'BRPT', 'INTP'],
                'Industrials': ['ASII', 'UNTR', 'AALI', 'SMGR'],
                'Consumer Cyclicals': ['GOTO', 'BUKA', 'MAPI', 'AMRT', 'MSIN'],
                'Consumer Non-Cyclicals': ['UNVR', 'ICBP', 'INDF', 'CPIN', 'MYOR'],
                'Healthcare': ['KLBF', 'MIKA', 'HEAL', 'SILO'],
                'Financials': ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'ARTO'],
                'Properties': ['BSDE', 'PWON', 'CTRA', 'SMRA'],
                'Technology': ['GOTO', 'BUKA', 'EMT K', 'WIFI'],
                'Infrastructures': ['TLKM', 'ISAT', 'EXCL', 'JSMR', 'TOWR', 'TBIG'],
                'Logistics': ['ASSA', 'BIRD', 'SMDR', 'TMAS']
            };

            const targetYSectors = sectorMapping[sector] || [];
            const topTickers = curatedTickers[sector] || [];

            try {
                const { data: dbStocks, error: dbErr } = await supabase
                    .from('stock_fundamentals')
                    .select('symbol, name, full_data')
                    .in('sector', targetYSectors)
                    .limit(20);

                const { fetchQuote } = require('../../src/utils/yahoofinance');
                const results = [];
                const addedSymbols = new Set();

                if (dbStocks) {
                    dbStocks.forEach(s => {
                        const sym = s.symbol.replace('.JK', '');
                        results.push({
                            symbol: sym,
                            name: s.name,
                            price: s.full_data?.price || 0,
                            change: s.full_data?.quote?.regularMarketChangePercent || 0
                        });
                        addedSymbols.add(sym);
                    });
                }

                const filteredCurated = topTickers.filter(t => !addedSymbols.has(t));
                if (filteredCurated.length > 0) {
                    const curatedQuotes = await fetchQuote(filteredCurated.map(t => `${t}.JK`));
                    const quotesArray = Array.isArray(curatedQuotes) ? curatedQuotes : [curatedQuotes];

                    quotesArray.forEach(q => {
                        if (!q) return;
                        const sym = q.symbol.replace('.JK', '');
                        results.push({
                            symbol: sym,
                            name: q.longName || q.shortName || sym,
                            price: q.regularMarketPrice || 0,
                            change: q.regularMarketChangePercent || 0
                        });
                    });
                }

                const finalResult = results.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

                sectorEmitentsCache.set(sector, {
                    timestamp: Date.now(),
                    data: finalResult
                });

                return res.json({
                    success: true,
                    sector: sector,
                    data: finalResult
                });
            } catch (err) {
                console.error('Sector Emitents Error:', err);
                return res.status(500).json({ error: 'Failed to fetch sector emitents' });
            }

        case 'sectors':
            if (sectorsCache && (Date.now() - sectorsCacheTime < SECTOR_CACHE_TTL)) {
                console.log('[CACHE HIT] Sectors data');
                return res.json({
                    success: true,
                    data: sectorsCache,
                    cached: true,
                    active_theme: activeTheme
                });
            }

            console.log('[CACHE MISS] Fetching fresh sectors data...');
            const sectors = await fetchSectors();
            if (!sectors) {
                return res.status(500).json({ error: 'Gagal mengambil data sektor.' });
            }

            sectorsCache = sectors;
            sectorsCacheTime = Date.now();

            return res.json({
                success: true,
                data: sectors,
                active_theme: activeTheme
            });
    }

    if (!result) {
        return null; // Not handled
    }

    // Default HTML/Markdown formatting
    const isHtml = /<[a-z][\s\S]*>/i.test(result);
    let htmlOutput = result;
    if (!isHtml) {
        const markedFn = await loadMarked();
        htmlOutput = markedFn(result, { breaks: true });
    }
    if (!htmlOutput.includes('<p>') && !htmlOutput.includes('<br>')) {
        htmlOutput = htmlOutput.replace(/\n/g, '<br>');
    }

    return res.status(200).json({
        success: true,
        data: htmlOutput,
        active_theme: activeTheme
    });
}

module.exports = { handleMarketAction };
