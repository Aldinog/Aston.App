const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const { computeIndicators, getLatestSignal } = require('./indicators');

// Top 35 Indonesian Stocks (Liquid & Large Cap)
const STOCK_LIST = [
    "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK",
    "ASII.JK", "UNVR.JK", "ICBP.JK", "INDF.JK", "KLBF.JK",
    "ADRO.JK", "PTBA.JK", "ITMG.JK", "UNTR.JK", "PGAS.JK",
    "MEDC.JK", "INCO.JK", "ANTM.JK", "TINS.JK", "DEWA.JK",
    "ARTO.JK", "BUVA.JK", "SMDR.JK", "SMGR.JK", "INTP.JK",
    "BRIS.JK", "AMRT.JK", "MAPI.JK", "JSMR.JK", "TBIG.JK",
    "TOWR.JK", "EMTK.JK", "SCMA.JK", "HRUM.JK", "AKRA.JK"
];

async function fetchCandles(symbol, days = 60) {
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days * 2); // Fetch more tailored for trading days

        const queryOptions = { period1: start, period2: end, interval: '1d' };
        const result = await yahooFinance.historical(symbol, queryOptions);

        // Ensure we have enough data
        if (!result || result.length < 50) return null;
        return result;
    } catch (err) {
        console.error(`Error fetching ${symbol}:`, err.message);
        return null;
    }
}

// Candlestick Pattern Detection
function detectPattern(candles) {
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    if (!current || !prev) return null;

    const currentBody = Math.abs(current.close - current.open);
    const prevBody = Math.abs(prev.close - prev.open);
    const currentRange = current.high - current.low;

    const isBullish = current.close > current.open;
    const isBearish = current.close < current.open;
    const isPrevBullish = prev.close > prev.open;
    const isPrevBearish = prev.close < prev.open;

    // Bullish Engulfing
    if (isBullish && isPrevBearish &&
        current.close > prev.open && current.open < prev.close) {
        return 'Bullish Engulfing';
    }

    // Bearish Engulfing
    if (isBearish && isPrevBullish &&
        current.close < prev.open && current.open > prev.close) {
        return 'Bearish Engulfing';
    }

    // Doji (Body is very small relative to range)
    if (currentBody <= (currentRange * 0.1) && currentRange > 0) {
        return 'Doji';
    }

    // Shooting Star (Small body at lower end, long upper shadow)
    // Upper shadow >= 2x body, Lower shadow very small
    const upperShadow = current.high - Math.max(current.open, current.close);
    const lowerShadow = Math.min(current.open, current.close) - current.low;

    if (upperShadow >= (2 * currentBody) && lowerShadow <= (0.5 * currentBody) && currentBody > 0) {
        // A shooting star is typically bearish, often found in uptrends, but we strictly define shape here
        return 'Shooting Star';
    }

    // Hanging Man / Hammer logic could be added here similar to Shooting Star
    // Hammer: Small body at upper end, long lower shadow
    if (lowerShadow >= (2 * currentBody) && upperShadow <= (0.5 * currentBody) && currentBody > 0) {
        if (isBearish) return 'Hanging Man'; // Often considered bearish after uptrend
        return 'Hammer'; // Often bullish after downtrend
    }

    return null;
}

async function getTopMovers() {
    try {
        // Optimized: Fetch all quotes in a single batch request
        const quotes = await yahooFinance.quote(STOCK_LIST);

        if (!quotes || quotes.length === 0) return { gainers: [], losers: [] };

        const valid = quotes.map(q => ({
            symbol: q.symbol,
            changePercent: q.regularMarketChangePercent || 0,
            price: q.regularMarketPrice
        }));

        // Top 3 Gainers
        const gainers = [...valid].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);

        // Top 3 Losers
        const losers = [...valid].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

        return { gainers, losers };
    } catch (error) {
        console.error("Error getting top movers:", error);
        return { gainers: [], losers: [] };
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Sector Mapping for the fixed STOCK_LIST
const SECTOR_MAP = {
    "BBCA.JK": "Finance", "BBRI.JK": "Finance", "BMRI.JK": "Finance", "BBNI.JK": "Finance",
    "TLKM.JK": "Infrastructure", "ASII.JK": "Industrial", "UNVR.JK": "Consumer", "ICBP.JK": "Consumer",
    "INDF.JK": "Consumer", "KLBF.JK": "Healthcare", "ADRO.JK": "Energy", "PTBA.JK": "Energy",
    "ITMG.JK": "Energy", "UNTR.JK": "Industrial", "PGAS.JK": "Energy", "MEDC.JK": "Energy",
    "INCO.JK": "Basic Material", "ANTM.JK": "Basic Material", "TINS.JK": "Basic Material",
    "DEWA.JK": "Energy", "ARTO.JK": "Finance", "BUVA.JK": "Consumer", "SMDR.JK": "Logistics",
    "SMGR.JK": "Basic Material", "INTP.JK": "Basic Material", "BRIS.JK": "Finance",
    "AMRT.JK": "Consumer", "MAPI.JK": "Consumer", "JSMR.JK": "Infrastructure",
    "TBIG.JK": "Infrastructure", "TOWR.JK": "Infrastructure", "EMTK.JK": "Technology",
    "SCMA.JK": "Consumer", "HRUM.JK": "Energy", "AKRA.JK": "Energy"
};

async function runScreener(filterSector = null) {
    const results = [];
    const allCandidates = [];
    console.log(`[SCREENER] Starting scan for sector: ${filterSector || 'All'}`);
    let processedCount = 0;
    let matchCount = 0;

    // Parallel fetching for all stocks (Yahoo Finance handles concurrency well)
    // We remove BATCH and DELAY to ensure we finish within Vercel's 10s limit
    // Sequential fetching to avoid Rate Limiting
    for (const symbol of STOCK_LIST) {
        // FILTER: Check sector first if filter exists
        const sector = SECTOR_MAP[symbol] || 'Others';
        if (filterSector && filterSector !== 'All' && sector !== filterSector) continue;

        try {
            const candles = await fetchCandles(symbol);
            if (!candles) continue;

            processedCount++;
            const indicators = computeIndicators(candles);
            const latest = indicators.latest;
            const pattern = detectPattern(candles);

            // Get Advanced Signal (Trend/SNR)
            const advSignal = getLatestSignal(candles);

            if (!latest.EMA20 || !latest.EMA50 || !latest.RSI) {
                console.log(`[SCREENER] Skipped ${symbol}: Incomplete indicators (EMA20: ${latest.EMA20}, RSI: ${latest.RSI})`);
                continue;
            }

            processedCount++;

            const last20Vols = candles.slice(-21, -1).map(c => c.volume);
            const avgVol = last20Vols.reduce((a, b) => a + b, 0) / 20;
            const currentVol = latest.latestVolume;

            // --- 1. VOLUME ANOMALY DETECTION ---
            const isHotVolume = currentVol > (avgVol * 3); // 300% Volume Spike

            // --- 2. MAGIC SCORE CALCULATION (0-100) ---
            let score = 0;
            // Trend (30%)
            if (latest.latestClose > latest.EMA20 && latest.EMA20 > latest.EMA50) score += 30;
            else if (latest.latestClose > latest.EMA50) score += 15;

            // Momentum (20%)
            if (latest.RSI >= 40 && latest.RSI <= 70) score += 20;
            else if (latest.RSI > 70) score += 10; // Overbought but strong

            // Volume Flow (20%)
            if (currentVol > avgVol) score += 20;

            // Pattern/Signal Bonus (30%)
            if (pattern) score += 30;
            if (advSignal.action !== 'WAIT') score += 20;
            if (isHotVolume) score += 10; // Extra bonus for hot volume

            score = Math.min(score, 100);

            // LOGIC MATCHING
            let matched = false;
            let reason = '';
            let signalType = 'NEUTRAL'; // BULLISH, BEARISH, NEUTRAL

            // Priority 1: Patterns
            if (pattern === 'Bullish Engulfing') {
                matched = true;
                reason = 'Bullish Engulfing';
                signalType = 'BULLISH';
            }
            else if (pattern === 'Bearish Engulfing') {
                matched = true;
                reason = 'Bearish Engulfing';
                signalType = 'BEARISH';
            }
            else if (pattern === 'Doji') {
                if (currentVol > avgVol * 1.5) {
                    matched = true;
                    reason = 'Doji + Vol Spike';
                    signalType = 'NEUTRAL';
                }
            }
            else if (pattern === 'Shooting Star') {
                if (latest.RSI > 60) {
                    matched = true;
                    reason = 'Shooting Star (High RSI)';
                    signalType = 'BEARISH';
                }
            }
            // Priority 2: Volume Anomaly
            else if (isHotVolume) {
                matched = true;
                reason = 'Volume Anomaly (Bandar Flow)';
                signalType = 'BULLISH';
            }
            // Priority 3: Advanced Signals (Trend/SNR)
            else if (advSignal.action !== 'WAIT') {
                matched = true;
                reason = advSignal.reason || 'Trend Supported';
                signalType = advSignal.action === 'BUY' ? 'BULLISH' : 'BEARISH';
            }
            // Priority 4: High Magic Score (Strong Trend without specific signal)
            else if (score >= 60) {
                matched = true;
                reason = 'Strong Technical Score';
                signalType = 'BULLISH';
            }

            // Always save candidate for fallback
            const candidateData = {
                symbol,
                sector,
                pattern: pattern || 'None',
                signalType: matched ? signalType : 'NEUTRAL',
                magicScore: score,
                isHotVolume,
                price: latest.latestClose,
                change: ((latest.latestClose - candles[candles.length - 2].close) / candles[candles.length - 2].close * 100).toFixed(2),
                rsi: latest.RSI.toFixed(1),
                avgVolume: Math.round(avgVol),
                volume: currentVol,
                reason: matched ? reason : 'Monitoring'
            };

            if (matched) {
                matchCount++;
                results.push(candidateData);
            }

            // Keep all for fallback
            allCandidates.push(candidateData);

            // Small delay to be safe
            await new Promise(r => setTimeout(r, 20)); // Reduced delay to 20ms to speed up processing
        } catch (err) {
            console.error(`Screener error for ${symbol}:`, err.message);
        }
    }

    console.log(`[SCREENER] Finished. Scanned: ${processedCount}, Matched: ${matchCount}`);

    // FALLBACK: If no results found, return top 5 by Magic Score
    if (results.length === 0 && allCandidates.length > 0) {
        console.log('[SCREENER] No strict matches found. Returning top 5 fallback candidates.');
        return allCandidates
            .sort((a, b) => b.magicScore - a.magicScore)
            .slice(0, 5);
    }

    // Sort by Magic Score highest
    return results.sort((a, b) => b.magicScore - a.magicScore);
}

module.exports = { runScreener, getTopMovers, STOCK_LIST };
