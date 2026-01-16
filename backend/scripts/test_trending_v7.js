const YahooFinance = require('yahoo-finance2').default;
// validation: false to skip schema check
const yahooFinance = new YahooFinance({
    suppressNotices: ['ripHistorical', 'yahooSurvey'],
    validation: { logErrors: false } // Try to suppress validation error throwing? 
    // actually older versions didn't allow skipping, but v2 might.
});

// Actually, in yahoo-finance2, you can suppress validation errors via logger or maybe just try catch
// But the library throws by default on validation failure.
// Let's try to set it.
yahooFinance._opts.validation = { logErrors: true, logOptionsErrors: false };
// Wait, looking at docs (from memory), specific options needed.

async function testV7() {
    try {
        console.log('--- TESTING TRENDING (Validation Skipped?) ---');
        // We can't easily skip validation in the library without patching or config.
        // But let's try 'screener' again with 'day_gainers' and check if we can filter.

        // Actually, let's try the "Simulated" approach here too as a benchmark.
        // Fetch quotes for partial list.

        // But first, let's try to access trending with a different region string? 'Indonesia'?
        const trending = await yahooFinance.trendingSymbols('ID');
        console.log(JSON.stringify(trending, null, 2));

    } catch (e) {
        console.log("Still failing:", e.message);
    }
}

testV7();
