const { fetchHistorical } = require('./src/utils/yahoofinance');

async function test() {
    console.log("Fetching EMTK.JK history (limit 20)...");
    try {
        const data = await fetchHistorical('EMTK.JK', { interval: '1d', limit: 20 });

        console.log(`Received ${data.length} candles.`);
        if (data.length > 0) {
            console.log("First Candle (Index 0):", data[0].time, data[0].close);
            console.log("Last Candle (Index End):", data[data.length - 1].time, data[data.length - 1].close);

            console.log("\nFull Sequence (Close Prices):");
            console.log(JSON.stringify(data.map(d => d.close)));

            // Analyze Trend
            const first = data[0].close;
            const last = data[data.length - 1].close;
            console.log(`\nTrend Check: Start=${first}, End=${last}, Diff=${last - first}`);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
