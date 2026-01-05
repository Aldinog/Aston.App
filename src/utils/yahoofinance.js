const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({
    suppressNotices: ['ripHistorical', 'yahooSurvey'],
    fetchOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1'
        }
    }
});
const { supabase } = require('./supabase');
const axios = require('axios');

// --- In-Memory Cache ---
const historicalCache = new Map();
const profileCache = new Map();
const sectorCache = { data: null, timestamp: 0 };

const CACHE_TTL_HISTORICAL = 3 * 60 * 1000; // 3 minutes
const CACHE_TTL_PROFILE = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_SECTORS = 15 * 60 * 1000; // 15 minutes

// Retry logic helper
async function withRetry(fn, retries = 2, delay = 1000) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
                console.warn(`[YF] Rate limit hit!`);

                // --- AUTO COOLDOWN & ALERTING ---
                if (i === 0) { // On first hit, notify and set cooldown
                    triggerAutoCooldown(err.message);
                }

                if (i === retries) throw err;
                console.warn(`[YF] Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2; // Exponential backoff
                continue;
            }
            throw err;
        }
    }
}

async function triggerAutoCooldown(reason) {
    try {
        const endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabase.from('app_settings').upsert([
            { key: 'cooldown_mode', value: true },
            { key: 'cooldown_end_time', value: endTime }
        ]);

        const adminId = process.env.ADMIN_ID;
        const botToken = process.env.TELEGRAM_TOKEN;
        if (adminId && botToken) {
            const message = `⚠️ <b>YAHOO FINANCE ALERT</b>\n\nIP Server terdeteksi diblokir/limit!\nReason: <code>${reason}</code>\n\n<i>Mode Cooldown otomatis aktif selama 30 menit.</i>`;
            axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: adminId,
                text: message,
                parse_mode: 'HTML'
            }).catch(e => console.error('[ALERT] Failed to send Telegram alert:', e.message));
        }
    } catch (e) {
        console.error('[YF] Failed to trigger auto-cooldown:', e.message);
    }
}

/**
 * Fetch last N daily candles from Yahoo Finance
 */
async function fetchHistorical(symbol, opts = {}) {
    // Ensure .JK suffix if missing
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    // Default options
    const limit = opts.limit || 100;
    let interval = opts.interval || '1d';

    // Normalize interval for chart endpoint
    let fetchInterval = interval;
    if (interval === '1h') fetchInterval = '60m';
    if (interval === '4h') fetchInterval = '1h'; // We aggregate 1h to 4h
    if (interval === '15m') fetchInterval = '15m';

    // Date Logic
    const fromDate = new Date();
    if (fetchInterval === '15m' || fetchInterval === '30m' || fetchInterval === '5m') {
        fromDate.setDate(fromDate.getDate() - 30); // 30 days for small intraday
    } else if (fetchInterval === '60m' || fetchInterval === '1h') {
        fromDate.setDate(fromDate.getDate() - 60); // 60 days for hourly
    } else {
        fromDate.setDate(fromDate.getDate() - 730); // 2 years
    }

    const queryOptions = {
        period1: fromDate,
        interval: (fetchInterval === '4h' || fetchInterval === '1h') ? '1h' : fetchInterval
    };

    // --- Check In-Memory Cache ---
    const cacheKey = `${query}_${interval}_${limit}`;
    const cached = historicalCache.get(cacheKey);
    if (!opts.forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_TTL_HISTORICAL)) {
        console.log(`[CACHE HIT] Historical data for ${cacheKey}`);
        return cached.data;
    }

    try {
        // Use chart() instead of historical() for better support (Intraday)
        const result = await withRetry(() => yahooFinance.chart(query, queryOptions));

        if (!result || !result.quotes || result.quotes.length === 0) return [];

        // Map and Group by interval to merge "live" points with current candle
        const merged = new Map();

        result.quotes.forEach(q => {
            if (q.open == null || q.close == null) return;

            const time = (interval === '1d' || interval === '1wk' || interval === '1mo')
                ? q.date.toISOString().split('T')[0]
                : (() => {
                    const ts = Math.floor(new Date(q.date).getTime() / 1000);
                    if (interval === '4h') return ts - (ts % 14400); // 4 * 3600
                    if (interval === '60m' || interval === '1h') return ts - (ts % 3600);
                    if (interval === '30m') return ts - (ts % 1800);
                    if (interval === '15m') return ts - (ts % 900);
                    if (interval === '5m') return ts - (ts % 300);
                    if (interval === '2m') return ts - (ts % 120);
                    if (interval === '1m') return ts - (ts % 60);
                    return ts;
                })();

            if (!merged.has(time)) {
                merged.set(time, {
                    time,
                    open: q.open,
                    high: q.high,
                    low: q.low,
                    close: q.close,
                    volume: q.volume || 0
                });
            } else {
                const existing = merged.get(time);
                // Update with trailing data while preserving the original open
                existing.high = Math.max(existing.high, q.high);
                existing.low = Math.min(existing.low, q.low);
                existing.close = q.close;
                existing.volume = (existing.volume || 0) + (q.volume || 0);
            }
        });

        const formatted = Array.from(merged.values());
        const finalData = opts.limit ? formatted.slice(-opts.limit) : formatted;

        // Save to cache
        historicalCache.set(cacheKey, {
            timestamp: Date.now(),
            data: finalData
        });

        return finalData;

    } catch (err) {
        console.error(`YF Error for ${query}:`, err.message);
        return [];
    }
}

async function fetchBrokerSummaryWithFallback(symbol) {
    return {
        success: false,
        message: "Fitur Broksum tidak tersedia di Yahoo Finance."
    };
}

// ======================
// PROXY BROKER ACTIVITY
// ======================

// Simple moving average
function sma(values, length) {
    if (values.length < length) return null;
    const slice = values.slice(-length);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Menganalisis aktivitas besar berdasarkan OHLC (Proxy Broker)
 */
function analyzeProxyBrokerActivity(candles) {
    if (!candles || candles.length === 0) return [];

    const result = [];
    const volumes = [];

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        volumes.push(c.volume);

        const avgVol = sma(volumes, 20);
        if (!avgVol) continue;

        let signals = [];

        const isBigActivity = c.volume > avgVol * 2;
        const strength = (c.close - c.open) / ((c.high - c.low) || 1);

        if (isBigActivity) {
            if (c.close > c.open) signals.push("BIG BUY (Akumulasi Besar)");
            else if (c.close < c.open) signals.push("BIG SELL (Distribusi Besar)");
        }

        if (strength > 0.6) signals.push("Buyer Dominan (Bull Strength)");
        if (strength < -0.6) signals.push("Seller Dominan (Bear Strength)");

        // Breakout volume
        const prevHighs = candles.slice(Math.max(0, i - 20), i).map(x => x.high);
        const highest20 = prevHighs.length ? Math.max(...prevHighs) : null;

        if (highest20 && c.close > highest20 && c.volume > avgVol * 1.5) {
            signals.push("Breakout Kuat (Volume Tinggi)");
        }

        if (signals.length > 0) {
            result.push({
                date: c.time,
                volume: c.volume,
                avgVol,
                strength,
                signals
            });
        }
    }

    return result;
}

/**
 * Format output siap kirim Telegram (HTML)
 */
function formatProxyBrokerActivity(symbol, activity) {
    if (!activity || activity.length === 0) {
        return `📊 <b>Proxy Broker Activity - ${symbol}</b>\n\nTidak ada aktivitas signifikan terdeteksi.`;
    }

    let text = `📊 <b>Proxy Broker Activity - ${symbol}</b>\n\n`;

    // Ambil 5 sinyal terbaru
    const latest = activity.slice(-5);

    latest.forEach(a => {
        text += `🕒 <b>${a.date}</b>\n`;
        text += `• Volume: ${a.volume.toLocaleString()} (Avg: ${Math.round(a.avgVol).toLocaleString()})\n`;
        text += `• Strength: ${a.strength.toFixed(2)}\n`;
        text += `• Signals:\n`;

        a.signals.forEach(sig => {
            text += `   - ${sig}\n`;
        });

        text += `\n`;
    });

    return text.trim();
}


async function fetchProfile(symbol) {
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    // --- Check In-Memory Cache ---
    const cached = profileCache.get(query);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_PROFILE)) {
        console.log(`[CACHE HIT] Profile data for ${query}`);
        return cached.data;
    }

    // --- Check Supabase Cache ---
    try {
        const { supabase } = require('./supabase');
        const { data: dbCache } = await supabase
            .from('stock_fundamentals')
            .select('full_data, last_updated')
            .eq('symbol', query)
            .single();

        if (dbCache && dbCache.last_updated) {
            const lastUpdate = new Date(dbCache.last_updated);
            const age = Date.now() - lastUpdate.getTime();
            if (age < CACHE_TTL_PROFILE && dbCache.full_data && dbCache.full_data.profile) {
                const profile = {
                    ...dbCache.full_data.profile,
                    name: dbCache.full_data.name,
                    symbol: dbCache.full_data.symbol
                };
                profileCache.set(query, { timestamp: lastUpdate.getTime(), data: profile });
                console.log(`[DB HIT] Profile for ${query}`);
                return profile;
            }
        }
    } catch (dbErr) {
        console.warn(`[DB ERROR] fetchProfile: ${dbErr.message}`);
    }

    try {
        const result = await withRetry(() => yahooFinance.quoteSummary(query, {
            modules: ["assetProfile", "price", "summaryProfile"]
        }));

        if (!result) return null;

        const profile = result.assetProfile || result.summaryProfile || {};
        const price = result.price || {};

        const finalProfile = {
            symbol: query,
            name: price.longName || price.shortName,
            sector: profile.sector,
            industry: profile.industry,
            summary: profile.longBusinessSummary || profile.description || "N/A",
            website: profile.website,
            city: profile.city,
            country: profile.country,
            employees: profile.fullTimeEmployees
        };

        // Update In-Memory Cache
        profileCache.set(query, { timestamp: Date.now(), data: finalProfile });

        return finalProfile;
    } catch (err) {
        console.error(`YF Profile Error for ${query}:`, err.message);
    }
}

function formatProfile(data) {
    if (!data) return "❌ Profil emiten tidak ditemukan.";

    return `🏢 <b>Profil Emiten: ${data.name} (${data.symbol.replace('.JK', '')})</b>\n\n` +
        `<b>Sektor:</b> ${data.sector || '-'}\n` +
        `<b>Industri:</b> ${data.industry || '-'}\n` +
        `<b>Lokasi:</b> ${data.city || '-'}, ${data.country || '-'}\n` +
        `<b>Karyawan:</b> ${data.employees ? data.employees.toLocaleString() : '-'}\n` +
        `<b>Website:</b> ${data.website || '-'}\n\n` +
        `<b>Tentang Perusahaan:</b>\n` +
        `<i>${data.summary.slice(0, 1000)}${data.summary.length > 1000 ? '...' : ''}</i>\n\n` +
        `<i>Data by Yahoo Finance</i>`;
}

async function fetchSectors() {
    const sectorSymbols = [
        'IDXENERGY.JK', 'IDXBASIC.JK', 'IDXINDUST.JK', 'IDXCYCLIC.JK',
        'IDXNONCYC.JK', 'IDXHEALTH.JK', 'IDXFINANCE.JK', 'IDXPROPERT.JK',
        'IDXTECHNO.JK', 'IDXINFRA.JK', 'IDXTRANS.JK'
    ];

    // --- Check In-Memory Cache ---
    if (sectorCache.data && (Date.now() - sectorCache.timestamp < CACHE_TTL_SECTORS)) {
        console.log(`[CACHE HIT] Sector data`);
        return sectorCache.data;
    }

    try {
        const results = await withRetry(() => yahooFinance.quote(sectorSymbols));

        const nameMap = {
            'IDXENERGY.JK': 'Energy',
            'IDXBASIC.JK': 'Basic Materials',
            'IDXINDUST.JK': 'Industrials',
            'IDXCYCLIC.JK': 'Consumer Cyclicals',
            'IDXNONCYC.JK': 'Consumer Non-Cyclicals',
            'IDXHEALTH.JK': 'Healthcare',
            'IDXFINANCE.JK': 'Financials',
            'IDXPROPERT.JK': 'Properties',
            'IDXTECHNO.JK': 'Technology',
            'IDXINFRA.JK': 'Infrastructures',
            'IDXTRANS.JK': 'Logistics'
        };

        const mapped = results.map(q => ({
            symbol: q.symbol,
            name: nameMap[q.symbol] || q.shortName || q.symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePercent: q.regularMarketChangePercent,
            trend: q.regularMarketChangePercent >= 0 ? 'bull' : 'bear'
        }));

        sectorCache.data = mapped;
        sectorCache.timestamp = Date.now();

        return mapped;
    } catch (err) {
        console.error('YF Sector Fetch Error:', err.message);
        return null;
    }
}

module.exports = {
    fetchHistorical,
    fetchBrokerSummaryWithFallback,
    analyzeProxyBrokerActivity,
    formatProxyBrokerActivity,
    fetchQuote,
    fetchFundamentals,
    formatFundamentals,
    fetchProfile,
    formatProfile,
    fetchSectors
};

async function fetchQuote(symbol) {
    // If array, pass directly to yahooFinance.quote (it handles arrays)
    if (Array.isArray(symbol)) {
        try {
            return await yahooFinance.quote(symbol);
        } catch (err) {
            console.error(`YF Quotes Error:`, err.message);
            return [];
        }
    }

    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    try {
        const quote = await yahooFinance.quote(query);
        return quote;
    } catch (err) {
        console.error(`YF Quote Error for ${query}:`, err.message);
        return null;
    }
}

async function fetchFundamentals(symbol) {
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    try {
        // 1. Check Cache in Supabase
        const { supabase } = require('./supabase');
        const { data: cache } = await supabase
            .from('stock_fundamentals')
            .select('*')
            .eq('symbol', query)
            .single();

        const CACHE_HOURS = 24;
        if (cache && cache.last_updated) {
            const lastUpdate = new Date(cache.last_updated);
            const now = new Date();
            const ageHours = (now - lastUpdate) / (1000 * 60 * 60);

            if (ageHours < CACHE_HOURS && cache.full_data) {
                console.log(`[CACHE HIT] Fundamental data for ${query} is ${Math.round(ageHours)}h old.`);
                return cache.full_data;
            }
        }

        console.log(`[CACHE MISS/EXPIRED] Fetching new fundamental data for ${query} from Yahoo Finance...`);

        // 2. Fetch from Yahoo Finance (Comprehensive Modules)
        const modules = [
            "assetProfile",
            "summaryProfile",
            "summaryDetail",
            "price",
            "defaultKeyStatistics",
            "financialData",
            "majorHoldersBreakdown",
            "insiderHolders",
            "earningsHistory",
            "earnings",
            "institutionOwnership",
            "fundOwnership",
            "recommendationTrend",
            "earningsTrend",
            "calendarEvents"
        ];

        const result = await yahooFinance.quoteSummary(query, { modules });
        if (!result) return null;

        // Fetch News (Search API)
        let news = [];
        try {
            const searchResult = await yahooFinance.search(query);
            news = (searchResult.news || []).slice(0, 5).map(n => ({
                title: n.title,
                publisher: n.publisher,
                link: n.link,
                providerPublishTime: n.providerPublishTime,
                type: n.type
            }));
        } catch (newsErr) {
            console.warn(`[NEWS FETCH FAILED] ${newsErr.message}`);
        }

        // Structured extraction for easier handling
        const summary = result.summaryDetail || {};
        const stats = result.defaultKeyStatistics || {};
        const fin = result.financialData || {};
        const price = result.price || {};
        const profile = result.assetProfile || result.summaryProfile || {};

        const fullData = {
            symbol: query,
            name: price.longName || price.shortName,
            price: price.regularMarketPrice,
            currency: price.currency,
            profile: {
                sector: profile.sector,
                industry: profile.industry,
                summary: profile.longBusinessSummary || profile.description || "N/A",
                website: profile.website,
                city: profile.city,
                country: profile.country,
                employees: profile.fullTimeEmployees
            },
            valuation: {
                marketCap: summary.marketCap,
                peRatio: summary.trailingPE,
                forwardPE: summary.forwardPE,
                pegRatio: stats.pegRatio,
                pbRatio: stats.priceToBook,
                enterpriceValue: stats.enterpriseValue,
                evToRevenue: stats.enterpriseToRevenue,
                evToEbitda: stats.enterpriseToEbitda
            },
            growth: {
                revenueGrowth: fin.revenueGrowth,
                earningsGrowth: fin.earningsGrowth,
                revenueGrowthQuarterly: fin.revenueGrowth, // Note: Often same in this module, but we mark it
                earningsGrowthQuarterly: fin.earningsGrowth
            },
            profitability: {
                roe: fin.returnOnEquity,
                roa: fin.returnOnAssets,
                grossMargin: fin.grossMargins,
                operatingMargin: fin.operatingMargins,
                profitMargin: fin.profitMargins
            },
            cashflow: {
                totalCash: fin.totalCash,
                totalDebt: fin.totalDebt,
                operatingCashflow: fin.operatingCashflow,
                freeCashflow: fin.freeCashflow,
                quickRatio: fin.quickRatio,
                currentRatio: fin.currentRatio
            },
            holders: {
                insiderHoldersPercent: result.majorHoldersBreakdown ? result.majorHoldersBreakdown.insidersPercentHeld : null,
                institutionsHoldersPercent: result.majorHoldersBreakdown ? result.majorHoldersBreakdown.institutionsPercentHeld : null,
                institutionsCount: result.majorHoldersBreakdown ? result.majorHoldersBreakdown.institutionsCount : null,
                institutionOwnership: result.institutionOwnership || null,
                fundOwnership: result.fundOwnership || null
            },
            earnings: result.earningsHistory || {},
            quarterly: result.earnings && result.earnings.financialsChart ? result.earnings.financialsChart.quarterly : [],
            target: {
                mean: fin.targetMeanPrice,
                median: fin.targetMedianPrice,
                rec: fin.recommendationKey,
                consensus: result.recommendationTrend ? result.recommendationTrend.trend[0] : null
            },
            dividends: {
                yield: summary.dividendYield,
                rate: summary.dividendRate,
                exDate: summary.exDividendDate,
                payoutRatio: stats.payoutRatio
            },
            news: news
        };

        // 3. Update Cache in Supabase
        await supabase.from('stock_fundamentals').upsert({
            symbol: query,
            name: fullData.name,
            sector: fullData.profile.sector,
            industry: fullData.profile.industry,
            summary: fullData.profile.summary,
            full_data: fullData,
            last_updated: new Date().toISOString()
        });

        return fullData;
    } catch (err) {
        console.error(`YF Fundamental Error for ${query}:`, err.message);
        return null;
    }
}

function formatFundamentals(data) {
    if (!data) return "❌ Data fundamental tidak ditemukan.";

    // Check if it's returning the full object (new version) or old version
    // If it has 'valuation' key, it's the new full data
    if (data.valuation) {
        // For the bot response, we'll keep it concise but improved.
        // Detailed data will be on the NEW PAGE.

        const fmtNum = (num) => num != null ? num.toLocaleString('id-ID') : '-';
        const fmtPct = (num) => num != null ? (num * 100).toFixed(2) + '%' : '-';
        const fmtCap = (val) => {
            if (val == null) return '-';
            if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
            if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
            return val.toLocaleString();
        };

        return `🏛 <b>Fundamental: ${data.name} (${data.symbol.replace('.JK', '')})</b>\n` +
            `Harga: ${fmtNum(data.price)} ${data.currency || ''}\n\n` +
            `<b>Valuation:</b>\n` +
            `• Market Cap: ${fmtCap(data.valuation.marketCap)}\n` +
            `• P/E Ratio: ${data.valuation.peRatio ? data.valuation.peRatio.toFixed(2) + 'x' : '-'}\n` +
            `• PBV Ratio: ${data.valuation.pbRatio ? data.valuation.pbRatio.toFixed(2) + 'x' : '-'}\n\n` +
            `<b>Profitability:</b>\n` +
            `• ROE: ${fmtPct(data.profitability.roe)}\n` +
            `• Net Margin: ${fmtPct(data.profitability.profitMargin)}\n\n` +
            `<b>Cash Flow:</b>\n` +
            `• Operating CF: ${fmtCap(data.cashflow.operatingCashflow)}\n\n` +
            `<i>Data lebih lengkap tersedia di halaman Fundamental.</i>`;
    }

    // Fallback for old data structure if any
    return "❌ Format data tidak valid.";
}
