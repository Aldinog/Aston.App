module.exports = async (req, res) => {
    try {
        // Construct the query string from the incoming request
        // e.g., ?token_hash=xyz&type=signup&...
        const queryParams = new URLSearchParams(req.query).toString();

        // Construct the deep link URL
        // app.json scheme is 'astonbot'
        const deepLink = `astonbot://auth/callback?${queryParams}`;

        console.log(`[AUTH] Proxying callback to: ${deepLink}`);

        // Perform a 302 Redirect to the custom scheme
        // This tells the browser/webview to open the app
        res.redirect(deepLink);
    } catch (err) {
        console.error('[AUTH] Callback Proxy Error:', err);
        res.status(500).send('Authentication Redirect Failed');
    }
};
