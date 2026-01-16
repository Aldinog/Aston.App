const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

async function testMethods() {
    try {
        console.log('Testing screener({ scrIds: "day_gainers" })...');
        // Note: region 'ID' or 'id' might be needed, or count
        const result = await yahooFinance.screener({ scrIds: 'day_gainers', count: 10, region: 'ID', lang: 'en-US' });

        console.log('Result Quotes:', result.quotes ? result.quotes.length : 0);
        if (result.quotes && result.quotes.length > 0) {
            console.log(JSON.stringify(result.quotes[0], null, 2)); // Print first item structure
        }
    } catch (e) {
        console.error('Test Error:', e.message);
    }
}

testMethods();
