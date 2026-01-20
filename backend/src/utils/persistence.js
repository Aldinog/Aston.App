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

    // --- STALE DATA CHECK (Updated) ---
    // If it's weekend or outside market hours, we normally trust DB to save API calls.
    // BUT we must ensure the data in DB is actually "fresh" (covers the last trading session).

    let isDataUpToDate = false;
    if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        // Time stored in DB is typically Unix Timestamp (seconds). Convert to Jakarta Time.
        const lastDate = moment.unix(lastCandle.time).tz('Asia/Jakarta');

        // Determine "Expected Last Trading Day" based on NOW
        let expectedMarketDate = now.clone();

        // 1. Adjust for Weekend/Early Morning
        if (now.day() === 0) { // Sunday -> Expect Friday
            expectedMarketDate.subtract(2, 'days');
        } else if (now.day() === 6) { // Saturday -> Expect Friday
            expectedMarketDate.subtract(1, 'days');
        } else if (now.day() === 1 && now.hour() < 9) { // Monday morning before open -> Expect Friday
            expectedMarketDate.subtract(3, 'days');
        } else if (now.hour() < 9) { // Tue-Fri morning before open -> Expect Yesterday
            expectedMarketDate.subtract(1, 'days');
        }

        // 2. Validate Date Match
        const isSameDate = lastDate.isSame(expectedMarketDate, 'day');

        if (interval === '1d' || interval === '1wk' || interval === '1mo') {
            // For Daily+: Date match is sufficient
            if (isSameDate) isDataUpToDate = true;
        } else {
            // For Intraday: Check if we have Session 2 data (Last candle hour >= 13:00)
            // IDX Session 2 starts ~13:30. Candles usually timestamps 13:xx, 14:xx, 15:xx.
            if (isSameDate) {
                const lastHour = lastDate.hour();
                // Valid if we have at least entered Session 2 ( > 12:00 )
                if (lastHour >= 13) isDataUpToDate = true;
            }
        }
    }

    // Only Start Blocking Fetch if:
    // 1. Market is Closed OR Weekend
    // 2. We actually have data
    // 3. That data is CONFIRMED Fresh (UpToDate)
    if ((isWeekend || !isMarketOpen) && candles.length > 0 && isDataUpToDate) {
        console.log(`[PERSISTENCE] Market closed & Data fresh (${interval}). Using DB data.`);
        return candles.map(c => ({
            ...c,
            time: (interval === '1d' || interval === '1wk' || interval === '1mo')
                ? new Date(c.time * 1000).toISOString().split('T')[0]
                : c.time
        }));
    } else if ((isWeekend || !isMarketOpen) && candles.length > 0 && !isDataUpToDate) {
        console.log(`[PERSISTENCE] Stale data detected for ${query} (${interval}). Force updating from YF...`);
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
        if (err.message && err.message.includes('User is unable to access')) {
            console.warn(`[PERSISTENCE] YF Access Denied for ${query}. Using DB Fallback.`);
        } else {
            console.error('[PERSISTENCE] YF Sync Error:', err.message);
        }
    }

    return candles;
}

module.exports = { getPersistentCandles };
