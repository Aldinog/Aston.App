const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- ROUTES ---

// 1. Webhook Bot (Legacy Vercel compatibility)
// We wrap the existing webhook.js function
const webhookHandler = require('./handlers/webhook');
app.post('/api/webhook', async (req, res) => {
  try {
    await webhookHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Webhook Error:', err.message);
    if (!res.headersSent) res.status(500).send('Internal Error');
  }
});

// Diagnostic GET for webhook (to set webhook URL easily)
app.get('/api/webhook', async (req, res) => {
  try {
    await webhookHandler(req, res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. Web API (Mini App / Admin Dashboard)
const webApiHandler = require('./handlers/web');
app.post('/api/web', async (req, res) => {
  try {
    await webApiHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Web API Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2.1 Auth Login (Mini App Login)
const loginHandler = require('./handlers/auth/login');
const callbackHandler = require('./handlers/auth/callback');

app.all('/api/auth/login', async (req, res) => {
  try {
    await loginHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Login Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2.1.1 Auth Callback Proxy (Supabase -> Mobile Deep Link)
app.get('/api/auth/callback', async (req, res) => {
  await callbackHandler(req, res);
});

// 2.2 Cron Tasks (Scanner & Screener)
const scannerHandler = require('./handlers/cron/scanner');
const screenerHandler = require('./handlers/cron/screener');
app.all('/api/cron/scanner', async (req, res) => {
  try {
    await scannerHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Scanner Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.all('/api/cron/screener', async (req, res) => {
  try {
    await screenerHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Screener Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2.3 User Watchlist
const watchlistHandler = require('./handlers/watchlist');
app.all('/api/watchlist', async (req, res) => {
  try {
    await watchlistHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Watchlist Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2.4 Event System
const eventRouter = require('./handlers/event');
app.use('/api/event', eventRouter);

// 2.5 Signal Cron Jobs
const generateSignalHandler = require('./handlers/cron/generate_signal');
const monitorSignalHandler = require('./handlers/cron/monitor_signals');

app.all('/api/cron/signal', async (req, res) => {
  try {
    await generateSignalHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Signal Gen Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.all('/api/cron/monitor', async (req, res) => {
  try {
    await monitorSignalHandler(req, res);
  } catch (err) {
    console.error('[SERVER] Signal Monitor Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// 3. Static Files (Frontend Mini App)
app.use(express.static(path.join(__dirname, '../public')));

// Fallback for SPA (if needed)
app.get(/.*/, (req, res, next) => {
  // Only handle if it's not an API call
  if (req.url.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server (Local Development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Astonology Server is running!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`🤖 Bot Webhook: http://localhost:${PORT}/api/webhook`);
    console.log(`📱 Mini App API: http://localhost:${PORT}/api/web`);
    console.log(`=========================================`);
  });
}

// Export implementation for Vercel
module.exports = app;
