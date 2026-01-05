const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance({
    suppressNotices: ['ripHistorical', 'yahooSurvey'],
    fetchOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    }
});

async function test() {
    console.log('Fetching BUVA.JK and BBCA.JK...');
    try {
        const results = await yahooFinance.quote(['BUVA.JK', 'BBCA.JK']);
        console.log('--- RESULT ---');
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
