const { Telegraf } = require('telegraf');
const { runScreener, getTopMovers } = require('../../src/utils/screener');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Helper safe send
async function sendSafe(chatId, text) {
    try {
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (e) {
        console.error(`Failed to send to ${chatId}:`, e.message);
    }
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    console.log(`[CRON] Screener started at ${new Date().toISOString()}`);

    // 2. Run Screener
    let results = [];
    try {
        results = await runScreener();
        console.log(`[CRON] Screener phase done in ${Date.now() - startTime}ms. Matches: ${results.length}`);
    } catch (e) {
        console.error("Screener crashed:", e);
        // We don't return 500 immediately to allow fallback to run if possible, 
        // or at least return a valid JSON response.
    }

    // 3. Prepare Message 
    let message = "🤖 <b>Daily Market Screener</b> 🇮🇩\n";
    message += `📅 ${new Date().toLocaleDateString('id-ID')}\n\n`;

    // 4. If results found
    if (results.length > 0) {
        message += "🔍 <b>Pattern Detected:</b>\n\n";
        results.forEach(r => {
            message += `📌 <b>${r.symbol.replace('.JK', '')}</b> (${r.reason})\n`;
            message += `   • Price: ${r.price}\n`;
            message += `   • Pattern: ${r.pattern}\n`;
            message += `   • RSI: ${r.rsi} | EMA20: ${r.ema20.toLocaleString()}\n\n`;
        });
    } else {
        message += "ℹ <i>Tidak ada pola candlestick signifikan yang ditemukan hari ini pada watchlist utama.</i>\n\n";
    }

    // 5. Always Append Top Movers (Fallback/Add-on)
    const moverStart = Date.now();
    try {
        message += "📊 <b>Market Snapshot</b>\n";
        const { gainers, losers } = await getTopMovers();
        console.log(`[CRON] Mover phase done in ${Date.now() - moverStart}ms`);

        if (gainers && gainers.length > 0) {
            message += "\n🚀 <b>Top Gainers:</b>\n";
            gainers.forEach(g => {
                message += `• ${g.symbol.replace('.JK', '')}: ${g.price} (${g.changePercent > 0 ? '+' : ''}${g.changePercent.toFixed(2)}%)\n`;
            });
        }

        if (losers && losers.length > 0) {
            message += "\n🔻 <b>Top Losers:</b>\n";
            losers.forEach(l => {
                message += `• ${l.symbol.replace('.JK', '')}: ${l.price} (${l.changePercent > 0 ? '+' : ''}${l.changePercent.toFixed(2)}%)\n`;
            });
        }
    } catch (e) {
        console.error("Fallback error:", e);
        message += "\n⚠️ <i>Gagal memuat snapshot pasar.</i>\n";
    }

    message += "\n💡 <i>Disclaimer: Not a financial advice. Do your own research.</i>";

    // 6. Send to Group(s)
    const targetChatId = process.env.TELEGRAM_CHANNEL_ID || process.env.GROUP_ID_TEST;

    if (targetChatId) {
        try {
            await sendSafe(targetChatId, message);
            console.log(`[CRON] Notification sent to ${targetChatId}`);
        } catch (sendErr) {
            console.error("[CRON] Failed to send notification:", sendErr.message);
        }
    } else {
        console.warn("[CRON] No target chat ID configured.");
    }

    const totalTime = Date.now() - startTime;
    console.log(`[CRON] Total execution time: ${totalTime}ms`);

    res.status(200).json({
        success: true,
        executionTime: totalTime,
        matches: results.length,
        messagePreview: message.slice(0, 100) + '...'
    });
};
