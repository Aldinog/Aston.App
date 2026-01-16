const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

async function testV5() {
    try {
        console.log('--- TESTING trendingSymbols("ID") ---');
        // 'ID' is standard ISO code for Indonesia
        const trending = await yahooFinance.trendingSymbols('ID');
        console.log(JSON.stringify(trending, null, 2));

        console.log('\n--- TESTING screener custom ---');
        // Let's see if we can filter results. 
        // If not, we might have to rely on 'trendingSymbols' which is often localized.
        // Or we could try to query specific predefined screener for Indonesia if it exists,
        // but 'day_gainers' with region 'ID' usually works. 
        // The previous output "FIGR" has "exchangeTimezoneName": "America/New_York", so it ignored region.

        // Let's try to fetch a specific quote of an Indonesian stock to see if there is a way to find "related" users won't like that.
        // We will stick to the plan: If trendingSymbols works, we use it. 

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testV5();
