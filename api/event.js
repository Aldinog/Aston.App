const express = require('express');
const router = express.Router();
const eventController = require('./controllers/eventController');
const jwt = require('jsonwebtoken');

// Middleware: Verify Token (Reuse logic or simplify)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        // Pass telegram_user_id to body for register convenience
        // But better to trust the token's ID than the body's
        // We will OVERRIDE body.telegram_user_id with the one from Token to be safe
        // However, user.telegram_user_id might be int or string.

        // Important: check if decoded has telegram_user_id. The login payload has it.
        // If not, we fetched it from DB in web.js. Here we simplify.
        if (decoded.telegram_user_id) {
            req.body.telegram_user_id = decoded.telegram_user_id;
        } else if (decoded.userId) {
            // ...
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const verifyAdmin = (req, res, next) => {
    const adminId = process.env.ADMIN_ID;
    if (String(req.user?.telegram_user_id) === String(adminId)) {
        next();
    } else {
        console.error(`[ADMIN AUTH FAIL] User: ${req.user?.telegram_user_id} vs Admin: ${adminId}`);
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
