const express = require('express');
const router = express.Router();
const eventController = require('./controllers/eventController');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware: Verify Token (Reuse logic or simplify)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-aston');
        req.user = decoded;

        if (decoded.telegram_user_id) {
            req.body = req.body || {}; // Safety check for GET requests
            req.body.telegram_user_id = decoded.telegram_user_id;
        }

        next();
    } catch (err) {
        console.error('[AUTH ERROR]', err.message);
        return res.status(401).json({ error: 'Invalid token', details: err.message });
    }
};

const verifyAdmin = (req, res, next) => {
    const adminId = process.env.ADMIN_ID;
    const userId = req.user?.telegram_user_id || req.user?.id || req.user?.telegram_id; // Try all possible keys

    console.log(`[AUTH DEBUG] Token Payload:`, JSON.stringify(req.user)); // Debug payload
    console.log(`[AUTH DEBUG] Admin Check: User ${userId} vs AdminEnv ${adminId}`);

    if (String(userId) === String(adminId)) {
        next();
    } else {
        console.error(`[ADMIN AUTH FAIL] User: ${userId} vs Admin: ${adminId}`);
        return res.status(403).json({ error: 'Admin only' });
    }
};

// Public Routes (But likely need Auth to prevent spam, so verifyToken is good)
router.get('/participants', eventController.getParticipants);

// Protected User Routes
router.post('/register', verifyToken, eventController.registerParticipant);

// Admin Routes
// Admin Routes
router.post('/control', verifyToken, verifyAdmin, eventController.adminControl);
router.get('/export', verifyToken, verifyAdmin, eventController.exportParticipants);

// Create Express App for Vercel & Local Compatibility
const app = express();
const cors = require('cors');

// Middleware for this isolated app
app.use(cors());
app.use(express.json());

// Dual Mount:
// 1. Vercel receives full path '/api/event/...' -> Remove '/api/event' prefix before passing to router
app.use('/api/event', router);
// 2. Local (src/index.js) mounts this app at '/api/event' -> Strips prefix -> Receives '/' (or relative) -> Pass to router
app.use('/', router);

module.exports = app;
