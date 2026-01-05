const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const { computeIndicators } = require('./indicators');

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

async function runScreener() {
    const results = [];

    // Parallel fetching for all stocks (Yahoo Finance handles concurrency well)
    // We remove BATCH and DELAY to ensure we finish within Vercel's 10s limit
    // Sequential fetching for all stocks to avoid rate limits
    for (const symbol of STOCK_LIST) {
        try {
            const candles = await fetchCandles(symbol);
            if (!candles) continue;

            const indicators = computeIndicators(candles);
            const latest = indicators.latest;
            const pattern = detectPattern(candles);

            if (!latest.EMA20 || !latest.EMA50 || !latest.RSI) continue;

            let matched = false;
            let reason = '';

            // LOGIC MATRIX
            if (pattern === 'Bullish Engulfing') {
                matched = true;
                reason = 'Bullish Engulfing Detected';
            }
            else if (pattern === 'Bearish Engulfing') {
                matched = true;
                reason = 'Bearish Engulfing Detected';
            }
            else if (pattern === 'Doji') {
                const last20Vols = candles.slice(-21, -1).map(c => c.volume);
                const avgVol = last20Vols.reduce((a, b) => a + b, 0) / 20;

                if (latest.latestVolume > avgVol * 1.5) {
                    matched = true;
                    reason = 'Doji with Volume Spike';
                }
            }
            else if (pattern === 'Shooting Star') {
                if (latest.RSI > 60) {
                    matched = true;
                    reason = 'Shooting Star at High RSI';
                }
            }

            if (matched) {
                results.push({
                    symbol,
                    pattern,
                    price: latest.latestClose,
                    rsi: latest.RSI.toFixed(1),
                    ema20: latest.EMA20.toFixed(0),
                    ema50: latest.EMA50.toFixed(0),
                    volume: latest.latestVolume,
                    reason
                });
            }

            // Small delay to be safe
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            console.error(`Screener error for ${symbol}:`, err.message);
        }
    }

    return results;
}

module.exports = { runScreener, getTopMovers, STOCK_LIST };
