const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const { computeIndicators } = require('../../src/utils/indicators');
const { analyzeWithAI } = require('../../src/utils/ai');
const { supabase } = require('../../src/utils/supabase');
const { broadcastNotification } = require('../../src/utils/notification');

// --- CONSTANTS ---
const IDX80_LIST = [
    // Top Banks
    "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "BRIS.JK", "ARTO.JK", "BBTN.JK",
    // Telco & Tech
    "TLKM.JK", "ISAT.JK", "EXCL.JK", "GOTO.JK", "EMTK.JK", "BUKA.JK", "SCMA.JK",
    // Energy & Mining
    "ADRO.JK", "PTBA.JK", "ITMG.JK", "UNTR.JK", "PGAS.JK", "MEDC.JK", "HRUM.JK",
    "AKRA.JK", "MDKA.JK", "ANTM.JK", "INCO.JK", "TINS.JK", "MBMA.JK", "NCKL.JK",
    // Consumer & Retail
    "UNVR.JK", "ICBP.JK", "INDF.JK", "KLBF.JK", "MYOR.JK", "SIDO.JK", "CPIN.JK",
    "JPFA.JK", "AMRT.JK", "MAPI.JK", "ACES.JK", "ERAA.JK",
    // Property & Construction
    "BSDE.JK", "CTRA.JK", "PWON.JK", "SMRA.JK", "ASRI.JK", "SMGR.JK", "INTP.JK",
    // Others (Infra, Auto, etc)
    "ASII.JK", "JSMR.JK", "TBIG.JK", "TOWR.JK", "SRTG.JK", "ESSA.JK", "BRPT.JK",
    "TPIA.JK", "INKP.JK", "TKIM.JK"
];

const MIN_VOL_SPIKE = 1.2; // Volume > 1.2x Average
const MIN_GAIN_PCT = 1.0;  // Minimum +1% gain to be considered "Positive"
const RSI_MIN = 30;
const RSI_MAX = 75;

// Helper: Fetch quotes for "Simulated Trending"
async function getMarketMeat() {
    try {
        const quotes = await yahooFinance.quote(IDX80_LIST);
        if (!quotes) return [];

        return quotes.map(q => ({
            symbol: q.symbol,
            price: q.regularMarketPrice,
            changePercent: q.regularMarketChangePercent || 0,
            volume: q.regularMarketVolume,
            avgVolume: q.averageDailyVolume3Month || q.regularMarketVolume,
            marketCap: q.marketCap
        }));
    } catch (e) {
        console.error("Quote Error:", e.message);
        return [];
    }
}

async function fetchCandles(symbol) {
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 200); // Need enough for indicators
        const result = await yahooFinance.historical(symbol, { period1: start, period2: end, interval: '1d' });
        return (result && result.length > 50) ? result : null;
    } catch (e) { return null; }
}

module.exports = async (req, res) => {
    console.log('[CRON] Starting "Simulated Trending" Signal Generator...');
    const startTime = Date.now();
    let candidates = [];

    // 1. Get Market Snapshot (Quotes)
    const marketData = await getMarketMeat();
    console.log(`[CRON] Fetched ${marketData.length} quotes from IDX80.`);

    // 2. Filter for "Active Stocks" (Gainers OR Volume Spikes)
    const activeStocks = marketData.filter(m => {
        const isGainer = m.changePercent >= MIN_GAIN_PCT;
        const isVolSpike = m.volume > (m.avgVolume * MIN_VOL_SPIKE);
        // Cleanse penny stocks (< 200 perak)
        const isTradeable = m.price > 200;

        return isTradeable && (isGainer || isVolSpike);
    });

    console.log(`[CRON] Found ${activeStocks.length} active stocks.`);

    // 3. Technical Validation (RSI & Structure)
    for (const stock of activeStocks) {
        const candles = await fetchCandles(stock.symbol);
        if (!candles) continue;

        const { latest } = computeIndicators(candles);
        if (!latest.RSI || !latest.EMA20) continue;

        const rsi = latest.RSI;
        const ema20 = latest.EMA20;

        // Rule: Trend Alignment (Price > EMA20) && Healthy RSI
        if (latest.latestClose > ema20 && rsi >= RSI_MIN && rsi <= RSI_MAX) {
            candidates.push({
                symbol: stock.symbol,
                price: stock.price,
                change: stock.changePercent.toFixed(2),
                rsi: rsi.toFixed(1),
                volumeRatio: (stock.volume / stock.avgVolume).toFixed(1),
                score: (rsi < 50 ? 2 : 1) + (stock.changePercent > 3 ? 2 : 1) // Simple scoring
            });
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 50));
    }

    // 4. Selection
    if (candidates.length === 0) {
        console.log('[CRON] No candidates passed technical filter.');
        await supabase.from('daily_signals').insert([{
            symbol: 'CASH',
            action: 'WAIT',
            analysis_summary: 'Pasar sedang choppy. Tidak ada saham IDX80 yang valid (Trend + Volume). Mode Wait & See.',
            status: 'WAIT'
        }]);
        return res.json({ success: true, message: 'WAIT Signal' });
    }

    // Sort by Score desc, then by Volume Ratio
    candidates.sort((a, b) => b.score - a.score || b.volumeRatio - a.volumeRatio);
    const winner = candidates[0];
    console.log(`[CRON] Winner: ${winner.symbol} (+${winner.change}%, Vol: ${winner.volumeRatio}x)`);

    // 5. AI Analysis
    const prompt = `
    Anda adalah Aston, AI Analyst Pro.
    Analisa saham ${winner.symbol} (IDX Indonesia) untuk Trading Harian.
    
    Data Market Hari Ini:
    - Harga: ${winner.price}
    - Kenaikan: ${winner.change}%
    - Volume Spike: ${winner.volumeRatio}x rata-rata (High Demand!)
    - RSI: ${winner.rsi} (Momentum)

    Tugas:
    1. Action: BUY
    2. Entry Price (Area pullback sedikit dari harga sekarang).
    3. Target Price (TP) - Minimal swing 3-5%.
    4. Stop Loss (SL) - Ketat.
    5. Reason: Fokus pada Volume Spike dan Trend.
    6. Confidence: 80-95% (Karena ini saham trending).

    Output JSON Only:
    { "action": "BUY", "entry": "range", "target": "price", "stopLoss": "price", "confidence": "xx%", "reason": "text" }
    `;

    let aiResult = {};
    try {
        const aiText = await analyzeWithAI(prompt);
        // Clean markdown
        const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiResult = JSON.parse(cleanJson);
    } catch (e) {
        console.error('[CRON] AI Error, using fallback:', e);
        aiResult = {
            action: "BUY",
            entry: `${winner.price}`,
            target: `${Math.round(winner.price * 1.05)}`,
            stopLoss: `${Math.round(winner.price * 0.95)}`,
            confidence: "85%",
            reason: `Detected high volume flow (${winner.volumeRatio}x) and bullish momentum.`
        };
    }

    // 6. Save to DB
    const { error } = await supabase.from('daily_signals').insert([{
        symbol: winner.symbol,
        company_name: '', // Optional, UI fetches it or we leave blank
        action: aiResult.action,
        entry_price: aiResult.entry,
        target_price: aiResult.target,
        stop_loss: aiResult.stopLoss,
        ai_confidence: aiResult.confidence,
        analysis_summary: aiResult.reason,
        status: 'OPEN',
        updated_at: new Date()
    }]);

    if (!error) {
        // 7. Broadcast Notification (Fire & Forget)
        const notifTitle = `⚡ Aston Signal: ${winner.symbol}`;
        const notifBody = `${aiResult.action} @ ${aiResult.entry}. Target: ${aiResult.target}. Tap to view analysis!`;
        broadcastNotification(notifTitle, notifBody, { symbol: winner.symbol });
    }

    res.json({ success: true, signal: winner, ai: aiResult });
};
