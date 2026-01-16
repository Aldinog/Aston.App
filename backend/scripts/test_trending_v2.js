const YahooFinance = require('yahoo-finance2').default;

console.log('Available methods:', Object.keys(YahooFinance));

async function testMethods() {
    try {
        // Try dailyGainers if it exists (some versions have it)
        if (YahooFinance.dailyGainers) {
            console.log('Testing dailyGainers...');
            const gainers = await YahooFinance.dailyGainers({ count: 5, region: 'ID' });
            console.log(gainers);
        } else {
            console.log('dailyGainers NOT found.');
        }

        // Try searching for a common index to see "related" or similar
        // Or strictly use a hardcoded broad list if discovery fails?

        // Let's try to see if 'search' returns anything useful for query "gainers" (unlikely)
    } catch (e) {
        console.error(e);
    }
}

testMethods();
