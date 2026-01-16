const YahooFinance = require('yahoo-finance2').default;

async function testTrending() {
    try {
        console.log('--- TESTING TRENDING (ID) ---');
        // 'ID' is the region for Indonesia, or sometimes specific to Country code
        const trending = await YahooFinance.trending('ID');
        console.log(JSON.stringify(trending, null, 2));

        console.log('\n--- TESTING SEARCH (Top Gainers) ---');
        // dailyGainers is a pre-defined screener in Yahoo Finance
        // We might need to use 'screener' options
        const queryOptions = { scrIds: 'day_gainers', region: 'ID', count: 5 };
        // Yahoo-finance2 screener support varies, let's try search or regular quote if specific function exists
        // Actually yahoo-finance2 has .dailyGainers if mapped, or we use .screener

        // Let's try to verify if there is a direct function or we need to scrape/use specific query
        // Common method is using quotes on a known list, but user wants DISCOVERY.
        // Let's try `search` with news? No.

        // Try the 'trending' symbols first as it's most standard
    } catch (e) {
        console.error('Trending Error:', e.message);
    }
}

testTrending();
