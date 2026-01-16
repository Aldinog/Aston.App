const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

async function testMethods() {
    try {
        console.log('Testing instance.dailyGainers...');
        // dailyGainers might not be supported in all versions, but let's try
        // The error message earlier suggested checking docs, but we'll try the instance first
        // If dailyGainers is not on instance, we might need to use queryOptions

        if (yahooFinance.dailyGainers) {
            const gainers = await yahooFinance.dailyGainers({ count: 5, region: 'ID' });
            console.log(JSON.stringify(gainers, null, 2));
        } else {
            console.log('dailyGainers method missing on instance.');
            // Fallback: try search or screener
            // const result = await yahooFinance.search('trending', { ... });
        }
    } catch (e) {
        console.error('Test Error:', e.message);
    }
}

testMethods();
