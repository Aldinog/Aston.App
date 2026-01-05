require('dotenv').config();
const { getPersistentCandles } = require('./src/utils/persistence');

/**
 * Script untuk mengisi database Supabase dengan data candle dari laptop lokal.
 * IP Lokal biasanya tidak diblokir oleh Yahoo Finance.
 */
const STOCK_LIST = [
    'BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'GOTO', 'ADRO', 'UNTR', 'AMRT', 'ICBP',
    'BBNI', 'CPIN', 'TPIA', 'BRPT', 'KLBF', 'MDKA', 'ANTM', 'PGAS', 'PTBA', 'ITMG',
    'HRUM', 'INDF', 'MYOR', 'UNVR', 'AMRT', 'MIKA', 'HEAL', 'AKRA', 'MEDC', 'INKP',
    'TKIM', 'SMGR', 'INTP', 'EXCL', 'ISAT'
];

async function powerSync() {
    console.log('🚀 Starting Power Sync (Local to Supabase)...');
    console.log('--------------------------------------------');

    for (const symbol of STOCK_LIST) {
        try {
            // Kita tarik 300 candle terakhir (sekitar 1 tahun data harian)
            process.stdout.write(`🔄 Syncing ${symbol}... `);
            const start = Date.now();

            // getPersistentCandles otomatis meng-upsert ke Supabase
            const candles = await getPersistentCandles(symbol, '1d', 300);

            const duration = ((Date.now() - start) / 1000).toFixed(1);
            console.log(`✅ Success! (${candles.length} candles in ${duration}s)`);

            // Jeda lebih lama agar tidak memicu proteksi Yahoo (2 detik per saham)
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
        }
    }

    console.log('--------------------------------------------');
    console.log('🏁 Power Sync Finished! Data sekarang aman di Supabase.');
}

powerSync().catch(console.error);
