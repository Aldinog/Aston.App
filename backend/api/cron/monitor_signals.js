const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const { supabase } = require('../../src/utils/supabase');
const { broadcastNotification } = require('../../src/utils/notification');

module.exports = async (req, res) => {
    console.log('[CRON] Starting Signal Monitoring (TP/SL Check)...');

    try {
        // 1. Get ALL 'OPEN' signals
        const { data: activeSignals, error } = await supabase
            .from('daily_signals')
            .select('*')
            .eq('status', 'OPEN');

        if (error) throw error;
        if (!activeSignals || activeSignals.length === 0) {
            console.log('[CRON] No active signals to monitor.');
            return res.json({ message: 'No active signals.' });
        }

        console.log(`[CRON] Monitoring ${activeSignals.length} active signals...`);
        let updates = 0;

        // 2. Check Price for each signal
        for (const signal of activeSignals) {
            try {
                // Parse stored string values to float
                const targetPrice = parseFloat(signal.target_price);
                const stopLoss = parseFloat(signal.stop_loss);
                const symbol = signal.symbol;

                // Fetch real-time quote
                const quote = await yahooFinance.quote(symbol);
                const currentPrice = quote.regularMarketPrice;

                if (!currentPrice) continue;

                let newStatus = null;
                let notifTitle = '';
                let notifBody = '';

                // LOGIC: HIT TP or HIT SL
                if (signal.action === 'BUY') {
                    if (currentPrice >= targetPrice) {
                        newStatus = 'HIT_TP';
                        notifTitle = `💰 Take Profit: ${symbol}`;
                        notifBody = `Harga mencapai ${currentPrice}. Target ${targetPrice} tercapai! Amankan profit anda.`;
                    } else if (currentPrice <= stopLoss) {
                        newStatus = 'HIT_SL';
                        notifTitle = `⚠️ Stop Loss: ${symbol}`;
                        notifBody = `Harga menyentuh ${currentPrice}. Stop Loss di ${stopLoss}. Disiplin adalah kunci.`;
                    }
                }

                // TODO: Handle SELL action if implemented later (logic reversed)

                // 3. Update DB & Send Notif if status changed
                if (newStatus) {
                    // Update DB
                    await supabase
                        .from('daily_signals')
                        .update({
                            status: newStatus,
                            updated_at: new Date()
                        })
                        .eq('id', signal.id);

                    // Send Notification
                    await broadcastNotification(notifTitle, notifBody, {
                        symbol: symbol,
                        type: newStatus
                    });

                    console.log(`[CRON] Updated ${symbol}: ${newStatus} @ ${currentPrice}`);
                    updates++;
                }

            } catch (err) {
                console.error(`[CRON] Error monitoring ${signal.symbol}:`, err.message);
            }
        }

        res.json({ success: true, checked: activeSignals.length, updates });

    } catch (e) {
        console.error('[CRON] Monitor Error:', e);
        res.status(500).json({ error: e.message });
    }
};
