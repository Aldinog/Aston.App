const { supabase } = require('../utils/supabase');
const { fetchQuote } = require('../utils/yahoofinance');
const { validateTelegramInitData } = require('../utils/auth');

module.exports = async (req, res) => {
    // --- CORS Headers ---
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // --- Authentication (Bearer Token) ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];

    // Token Verification
    const jwt = require('jsonwebtoken');
    let user = null;
    try {
        user = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-aston');
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }

    const { action, symbol } = req.body || {};
    const method = req.method;

    try {
        // --- GET: Fetch Watchlist & Prices ---
        if (method === 'GET') {
            let symbols = [];

            // 1. Check if symbols are provided in Query Params (Local Storage Mode)
            if (req.query.symbols) {
                const rawSymbols = req.query.symbols.split(',');
                // Filter empty strings and normalize
                symbols = rawSymbols.filter(s => s.trim().length > 0).map(s => s.trim().toUpperCase());
            } else {
                // 2. Fallback: Fetch from Database (Legacy/Sync Mode)
                const { data: list, error } = await supabase
                    .from('user_watchlist')
                    .select('symbol')
                    .eq('user_id', user.id);

                if (error) throw error;
                if (list) symbols = list.map(i => i.symbol);
            }

            if (symbols.length === 0) {
                return res.json({ success: true, data: [] });
            }

            // --- SMART CACHING STRATEGY ---
            // 1. Check App Settings for 'force_weekend_fetch'
            const { data: settings } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'force_weekend_fetch')
                .single();

            const forceFetch = settings ? (settings.value === true || settings.value === 'true') : false;

            // 2. Check if Weekend (Saturday=6, Sunday=0)
            const today = new Date();
            const day = today.getDay();
            const isWeekend = (day === 6 || day === 0);

            // --- MAIN DATA FETCHING LOGIC ---
            // Designed to be robust: fetches sparklines from DB, prices from Cache/Yahoo.

            // 1. Fetch Sparklines (Always try DB first, batch fetch)
            let sparklineMap = new Map();
            let lastKnownPrices = new Map(); // fallback map
            // Cutoff: 7 Days ago (in seconds) to prevent mixing old data
            const cutoffTime = Math.floor(Date.now() / 1000) - (14 * 24 * 3600); // 14 days safe buffer for holidays

            try {
                // Fetch candles for all symbols (H1 interval, ordered to get latest)
                const { data: dbCandles, error: candleError } = await supabase
                    .from('stock_candles')
                    .select('symbol, close, time')
                    .in('symbol', symbols.map(s => s.includes('.') ? s : `${s}.JK`))
                    .eq('interval', '1h')
                    .gte('time', cutoffTime) // Only recent data
                    .order('time', { ascending: true });

                if (!candleError && dbCandles) {
                    dbCandles.forEach(c => {
                        const cleanSym = c.symbol.replace('.JK', '');
                        if (!sparklineMap.has(cleanSym)) sparklineMap.set(cleanSym, []);
                        const arr = sparklineMap.get(cleanSym);

                        // Capture Latest Price for Fallback (since ordered by time ascending)
                        lastKnownPrices.set(cleanSym, c.close);

                        // Push object first to check time later, or just value? 
                        // We need time for staleness check
                        arr.push({ c: c.close, t: c.time });

                        // Changed limit 20 -> 30 for H1
                        if (arr.length > 30) arr.shift();
                    });
                }
            } catch (e) { console.error('[WATCHLIST] Sparkline Fetch Error:', e); }

            // Trigger Backfill for missing OR STALE sparklines
            const currentUnix = Math.floor(Date.now() / 1000);
            const STALE_THRESHOLD = 3600 * 2; // 2 Hours

            const missingSparklines = symbols.filter(s => {
                const sl = sparklineMap.get(s);
                if (!sl || sl.length < 5) return true; // Not enough data

                // Check Staleness of the LAST candle
                const lastCandle = sl[sl.length - 1];

                // --- WEEKEND OPTIMIZATION ---
                // If it's Weekend (Sat/Sun), market is closed.
                // We shouldn't flag Friday's data as "stale" just because it's > 2 hours old.
                // Only trigger update if it's NOT weekend, or if the data is egregiously old (e.g. > 3 days)
                if (isWeekend) {
                    const THREE_DAYS = 3600 * 24 * 3;
                    if (currentUnix - lastCandle.t > THREE_DAYS) return true; // Truly missing/old
                } else {
                    // Weekday logic: Check aggressively (2 hours)
                    // Persistence will handle if market is actually closed (e.g. night)
                    if (currentUnix - lastCandle.t > STALE_THRESHOLD) return true;
                }

                return false;
            });

            if (missingSparklines.length > 0) {
                console.log(`[WATCHLIST] Backfilling/Refreshing ${missingSparklines.length} symbols (H1)...`);
                const { getPersistentCandles } = require('../utils/persistence');
                // Fire and forget (limited parallel)
                const limitParallel = 5;
                Promise.all(missingSparklines.slice(0, limitParallel).map(s => getPersistentCandles(s, '1h', 50))).catch(err => console.error(err));
            }

            // Map back to simple number array for frontend
            sparklineMap.forEach((entry, key) => {
                sparklineMap.set(key, entry.map(e => e.c));
            });

            // 2. Fetch Prices (Differs based on Weekend/Force)
            let finalQuotes = [];
            const CACHE_TTL_SECONDS = 60;
            const now = new Date();

            if (!isWeekend || forceFetch) {
                // Fetch Price Cache Candidates
                const { data: cachedCandidates, error: readError } = await supabase
                    .from('stock_price_cache')
                    .select('*')
                    .in('symbol', symbols);

                const validCacheMap = new Map();
                const allCacheMap = new Map(); // Store ALL cache regardless of freshness
                const symbolsToFetch = [];

                symbols.forEach(sym => {
                    const cached = cachedCandidates ? cachedCandidates.find(c => c.symbol === sym || c.symbol === `${sym}.JK`) : null;

                    if (cached) {
                        allCacheMap.set(sym, cached); // Save to backup map
                    }

                    let isPriceFresh = false;

                    if (cached && cached.last_updated) {
                        const age = (now - new Date(cached.last_updated)) / 1000;
                        if (age < CACHE_TTL_SECONDS) isPriceFresh = true;
                    }

                    if (isPriceFresh) validCacheMap.set(sym, cached);
                    else {
                        const querySym = (!sym.endsWith('.JK') && !sym.includes('.')) ? `${sym}.JK` : sym;
                        symbolsToFetch.push(querySym);
                    }
                });

                let newFetchedData = [];
                if (symbolsToFetch.length > 0) {
                    // console.log(`[WATCHLIST] Fetching prices for ${symbolsToFetch.length} symbols...`);
                    try {
                        const quotes = await fetchQuote(symbolsToFetch);
                        const quoteArray = Array.isArray(quotes) ? quotes : (quotes ? [quotes] : []);

                        const cacheUpdates = quoteArray.map(q => ({
                            symbol: q.symbol.replace('.JK', ''),
                            price: q.regularMarketPrice || q.regularMarketPreviousClose || 0,
                            change: q.regularMarketChange || 0,
                            changepercent: q.regularMarketChangePercent || 0,
                            prevclose: q.regularMarketPreviousClose || 0,
                            last_updated: new Date().toISOString()
                        }));

                        if (cacheUpdates.length > 0) {
                            // Upsert cache (Price only)
                            const { error: upsertError } = await supabase.from('stock_price_cache').upsert(cacheUpdates);
                            if (upsertError) console.error('[UPSERT ERROR]', upsertError.message);
                        }
                        newFetchedData = cacheUpdates;
                    } catch (e) {
                        console.error('[WATCHLIST] YF Quote Error (Using Fallback):', e.message);
                    }
                }

                // Combine Sources
                finalQuotes = symbols.map(sym => {
                    const fromNew = newFetchedData.find(x => x.symbol === sym);
                    // PRIORITY: 1. New Fetch, 2. Valid Cache, 3. Stale Cache (Fallback)
                    return fromNew || validCacheMap.get(sym) || allCacheMap.get(sym);
                }).filter(x => x);

            } else {
                // WEEKEND MODE: Serve from Price Cache Only
                console.log(`[WATCHLIST] Weekend/Cached Mode`);
                const { data: cachedData } = await supabase
                    .from('stock_price_cache')
                    .select('*')
                    .in('symbol', symbols);

                finalQuotes = (cachedData || []).map(c => ({
                    symbol: c.symbol.replace('.JK', ''),
                    price: c.price,
                    change: c.change,
                    changepercent: c.changepercent || c.changePercent,
                    prevclose: c.prevclose || c.prevClose
                }));
            }

            // --- 3. MERGE FINAL RESPONSE ---
            const populated = symbols.map(sym => {
                const targetSym = sym.replace('.JK', '');
                const q = finalQuotes.find(x => (x.symbol && x.symbol.replace('.JK', '') === targetSym));
                const sl = sparklineMap.get(targetSym) || [];
                const fallbackPrice = lastKnownPrices.get(targetSym) || 0;

                if (!q) {
                    return {
                        symbol: sym,
                        price: fallbackPrice,
                        change: 0, changePercent: 0, prevClose: fallbackPrice,
                        sparkline: sl
                    };
                }

                let p = q.price || q.regularMarketPrice || 0;
                let c = q.change || q.regularMarketChange || 0;
                let cp = q.changePercent || q.changepercent || q.regularMarketChangePercent || 0;
                let pc = q.prevClose || q.prevclose || q.regularMarketPreviousClose || 0;

                // Fix possible undefined properties when mapping from DB
                if (cp === undefined && q.changePercent !== undefined) cp = q.changePercent;
                if (pc === undefined && q.prevClose !== undefined) pc = q.prevClose;

                if (p === 0 && pc !== 0) p = pc;

                // ULTIMATE FALLBACK: If API returns 0 (market closed/error), use Candle Fallback
                if (p === 0 && fallbackPrice !== 0) p = fallbackPrice;

                return {
                    symbol: sym,
                    price: p,
                    change: c,
                    changePercent: cp,
                    prevClose: pc,
                    sparkline: sl
                };
            });

            // Fetch Paywall Mode for Frontend Limit Logic
            const { data: pwSettings } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'paywall_mode')
                .single();
            const paywallMode = pwSettings ? (pwSettings.value === true || pwSettings.value === 'true') : false;

            return res.json({
                success: true,
                data: populated,
                paywall_mode: paywallMode // Send to frontend
            });
        }

        // --- POST: Add to Watchlist ---
        if (method === 'POST') {
            if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

            // Verify symbol exists first
            const quote = await fetchQuote(symbol);
            if (!quote) return res.status(404).json({ error: 'Symbol not found' });

            // --- LIMIT CHECK ---
            // 1. Fetch App Settings (Paywall Mode)
            const { data: pwSettings } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'paywall_mode')
                .single();
            const paywallMode = pwSettings ? (pwSettings.value === true || pwSettings.value === 'true') : false;

            // 2. Fetch User Status (JWT doesn't have it)
            const { data: userData } = await supabase
                .from('users')
                .select('membership_status')
                .eq('id', user.id)
                .single();

            const status = userData ? userData.membership_status : 'standard';

            // 3. Define Limit
            let limit = 999; // Unlimited default
            if (paywallMode) {
                limit = (status === 'pro') ? 8 : 4;
            } else {
                // Even if Paywall OFF, we might want a sanity cap, but user requested 'unlimited' if OFF.
                // Let's keep it effectively unlimited or a high safe number like 50.
                limit = 50;
            }

            // 4. Count Current Watchlist
            const { count, error: countError } = await supabase
                .from('user_watchlist')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (countError) throw countError;

            if (count >= limit) {
                return res.status(403).json({
                    error: `Limit Watchlist Tercapai (${limit}). Hapus beberapa saham untuk menambah baru.`
                });
            }

            // Upsert Cache
            const cachePayload = {
                symbol: quote.symbol.replace('.JK', ''),
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                changepercent: quote.regularMarketChangePercent,
                prevclose: quote.regularMarketPreviousClose,
                last_updated: new Date().toISOString()
            };
            await supabase.from('stock_price_cache').upsert(cachePayload);

            const { error } = await supabase
                .from('user_watchlist')
                .insert([{ user_id: user.id, symbol: symbol.toUpperCase() }]);

            if (error) {
                if (error.code === '23505') return res.status(409).json({ error: 'Symbol already in watchlist' });
                throw error;
            }

            return res.json({ success: true, message: 'Added to watchlist', data: quote });
        }

        // --- DELETE: Remove from Watchlist ---
        if (method === 'DELETE') {
            const targetSymbol = req.query.symbol || symbol;
            if (!targetSymbol) return res.status(400).json({ error: 'Symbol is required' });

            const { error } = await supabase
                .from('user_watchlist')
                .delete()
                .eq('user_id', user.id)
                .eq('symbol', targetSymbol.toUpperCase());

            if (error) throw error;

            return res.json({ success: true, message: 'Removed from watchlist' });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (err) {
        console.error('Watchlist API Error:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
