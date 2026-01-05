const { supabase } = require('./supabase');
const { fetchHistorical } = require('./yahoofinance');
const moment = require('moment-timezone');

/**
 * Get candles for a symbol, interval, and limit.
 * Tries to fetch from DB first, then complements with YF if needed.
 */
async function getPersistentCandles(symbol, interval = '1d', limit = 300) {
    // Ensure .JK suffix for consistency
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    console.log(`[PERSISTENCE] Request: ${query} ${interval} Limit: ${limit}`);

    // 1. Get from DB
    let candles = [];
    try {
        const { data: dbData, error: dbError } = await supabase
            .from('stock_candles')
            .select('time, open, high, low, close, volume')
            .eq('symbol', query)
            .eq('interval', interval)
            .order('time', { ascending: false })
            .limit(limit);

        if (dbError) {
            console.error('[PERSISTENCE] DB Fetch Error:', dbError.message);
        } else if (dbData) {
            candles = dbData.reverse().map(c => ({
                ...c,
                // Normalize time format for the rest of the function or return
                time: Number(c.time)
            }));
        }
    } catch (err) {
        console.error('[PERSISTENCE] DB Exception:', err.message);
    }

    // --- MARKET HOURS LOGIC ---
    const now = moment().tz('Asia/Jakarta');
    const day = now.day(); // 0 (Sun) to 6 (Sat)
    const hour = now.hour();
    const minute = now.minute();
    const isWeekend = day === 0 || day === 6;

    // IDX Market Hours: ~08:00 - 16:00 WIB (Starting earlier for pre-opening/stale data sync)
    const isMarketOpen = !isWeekend && (hour >= 8 && hour < 16);

    // If it's weekend or outside market hours AND we have some data in DB,
    // we prioritize DB and SKIP fetching from Yahoo Finance to save IP reputation.
    if ((isWeekend || !isMarketOpen) && candles.length > 0) {
        console.log(`[PERSISTENCE] Market closed (${isWeekend ? 'Weekend' : 'After Hours'}). Using DB data only.`);
        return candles.map(c => ({
            ...c,
            time: (interval === '1d' || interval === '1wk' || interval === '1mo')
                ? new Date(c.time * 1000).toISOString().split('T')[0]
                : c.time
        }));
    }

    // 2. Fetch from YF to get the latest (missing) data
    // We fetch a larger batch initially if DB is empty to satisfy charting requirements (300 bars)
    try {
        const fetchLimit = candles.length < 30 ? 300 : 10;
        const yfCandles = await fetchHistorical(query, { interval, limit: fetchLimit });

        if (yfCandles && yfCandles.length > 0) {
            // Upsert NEW candles to DB
            const toUpsert = yfCandles.map(c => ({
                symbol: query,
                interval,
                time: typeof c.time === 'string' ? new Date(c.time).getTime() / 1000 : c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
            }));

            const { error: upsertError } = await supabase
                .from('stock_candles')
                .upsert(toUpsert, { onConflict: 'symbol, interval, time' });

            if (upsertError) {
                console.error('[PERSISTENCE] DB Upsert Error:', upsertError.message);
            }

            // Merge with DB data
            // Simple approach: Take the latest from YF and replace any overlaps
            const candleMap = new Map();
            candles.forEach(c => candleMap.set(c.time, c));
            toUpsert.forEach(c => candleMap.set(c.time, c));

            const combined = Array.from(candleMap.values())
                .sort((a, b) => a.time - b.time)
                .slice(-limit);

            return combined.map(c => ({
                ...c,
                // Ensure time format matches what the frontend expects (string or numeric)
                // yahoofinance.js returns string for 1d, numeric for intraday.
                // We'll normalize to what yahoofinance.js usually returns.
                time: (interval === '1d' || interval === '1wk' || interval === '1mo')
                    ? new Date(c.time * 1000).toISOString().split('T')[0]
                    : c.time
            }));
        }
    } catch (err) {
        console.error('[PERSISTENCE] YF Sync Error:', err.message);
    }

    return candles;
}

module.exports = { getPersistentCandles };
