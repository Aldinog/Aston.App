const { supabase } = require('../src/utils/supabase');
const jwt = require('jsonwebtoken');
const { handleAdminAction } = require('./controllers/adminController');
const { handleMarketAction } = require('./controllers/marketController');
const axios = require('axios');

async function checkTelegramMembership(userId, groupId, token, retries = 3) {
    const url = `https://api.telegram.org/bot${token}/getChatMember`;
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[TELEGRAM] Membership check attempt ${i + 1} for ${userId} in ${groupId}`);
            const response = await axios.get(url, {
                params: { chat_id: groupId, user_id: userId },
                timeout: 8000 // 8 second timeout
            });
            return response.data.result.status;
        } catch (error) {
            const isTimeout = error.code === 'ETIMEDOUT' || error.message.includes('timeout');
            if (i === retries - 1 || !isTimeout) {
                console.error(`[TELEGRAM] Final attempt failed for ${userId}:`, error.message);
                throw error;
            }
            console.warn(`[TELEGRAM] Attempt ${i + 1} timed out, retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, symbol } = req.body;
        console.log(`[WEB API] Action: ${action}, Symbol: ${symbol}`);

        let activeTheme = 'default';

        // --- Authentication Middleware ---
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('[WEB API] Unauthorized: Missing token');
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const token = authHeader.split(' ')[1];

        // SECURITY UPDATE: Removed fallback secret. JWT_SECRET is mandatory.
        if (!process.env.JWT_SECRET) {
            console.error('[CRITICAL] JWT_SECRET is not defined in environment variables.');
            return res.status(500).json({ error: 'Internal Server Configuration Error' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            console.warn(`[WEB API] JWT Error: ${jwtErr.message}`);
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        console.log(`[WEB API] Token verified for: ${decoded.userId || 'unknown'}`);

        // Check session in DB
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('user_id, users(*)')
            .eq('token', token)
            .single();

        if (sessionError || !session || !session.users.is_active) {
            return res.status(401).json({ error: 'Unauthorized: Invalid or inactive session' });
        }

        const user = session.users;
        const isAdmin = user.telegram_user_id.toString() === (process.env.ADMIN_ID || '');

        // Update Last Seen [NEW]
        supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then(({ error }) => {
            if (error) console.error('[WEB API] Failed to update last_seen_at:', error.message);
        });

        // --- Maintenance & Theme Logic ---
        const { data: appData } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['maintenance_mode', 'maintenance_end_time', 'active_theme', 'paywall_mode', 'feature_permissions', 'maintenance_whitelist', 'live_mode_whitelist', 'cooldown_mode', 'limit_chart_mode', 'limit_ai_mode', 'limit_ai_count']);

        const settingsMap = {};
        if (appData) {
            appData.forEach(item => settingsMap[item.key] = item.value);
        }

        let isMaintenance = settingsMap['maintenance_mode'] || false;
        let maintenanceEndTime = settingsMap['maintenance_end_time'];
        activeTheme = settingsMap['active_theme'] || 'default';
        const paywallMode = settingsMap['paywall_mode'] || false;
        const featurePermissions = settingsMap['feature_permissions'] || {};
        const maintenanceWhitelist = settingsMap['maintenance_whitelist'] || [];
        const liveModeWhitelist = settingsMap['live_mode_whitelist'] || [];
        const cooldownMode = settingsMap['cooldown_mode'] === true || settingsMap['cooldown_mode'] === 'true';
        const isWhitelisted = maintenanceWhitelist.includes(user.telegram_user_id.toString());

        // Auto-Disable Logic
        if (isMaintenance && maintenanceEndTime) {
            const now = new Date();
            const end = new Date(maintenanceEndTime);
            if (now >= end) {
                // Auto Turn Off
                await supabase.from('app_settings').upsert([
                    { key: 'maintenance_mode', value: false },
                    { key: 'maintenance_end_time', value: null }
                ]);
                isMaintenance = false;
                maintenanceEndTime = null;
                console.log('Maintenance Mode Auto-Disabled (Time Reached)');
            }
        }

        // If maintenance is ON and user is NOT admin and NOT whitelisted, block all
        if (isMaintenance && !isAdmin && !isWhitelisted) {
            return res.status(503).json({
                error: 'Mohon maaf APP masih Maintenance',
                code: 'MAINTENANCE_MODE',
                end_time: maintenanceEndTime // Return time for countdown
            });
        }

        // --- Auto-Downgrade & Expiry Check ---
        const now = new Date();
        // Only check expiry if user is PRO and has an expiry date
        if (user.membership_status === 'pro' && user.expires_at) {
            const expiry = new Date(user.expires_at);
            if (expiry < now) {
                console.log(`[WEB API] User ${user.telegram_user_id} PRO expired. Downgrading to standard (Lifetime).`);

                const { data: downgradedUser, error: downgradeError } = await supabase
                    .from('users')
                    .update({
                        membership_status: 'standard',
                        expires_at: null // Infinite
                    })
                    .eq('id', user.id)
                    .select()
                    .single();

                if (downgradeError) {
                    console.error('[WEB API] Downgrade Error:', downgradeError);
                } else {
                    user.membership_status = 'standard';
                    user.expires_at = null;
                }
            }
        }

        // --- COOLDOWN MODE CHECK (EARLY) ---
        const yfActions = ['price', 'profile', 'fundamental', 'indicators', 'analysis', 'proxy', 'chart', 'live-quote', 'signal', 'review', 'avg', 'sectors', 'sector-emitents'];
        if (cooldownMode && yfActions.includes(action)) {
            return res.status(200).json({ success: false, error: 'COOLDOWN' });
        }

        // --- Membership Check (CRITICAL) ---
        if (!isAdmin) {
            const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
            const lastCheck = user.last_membership_check ? new Date(user.last_membership_check).getTime() : 0;
            const isExpired = (Date.now() - lastCheck) > CACHE_DURATION;

            let currentStatus = user.membership_status;
            const groupIds = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
            const primaryGroupId = groupIds[0];

            if (currentStatus !== 'member' || isExpired) {
                try {
                    currentStatus = await checkTelegramMembership(user.telegram_user_id, primaryGroupId, process.env.TELEGRAM_TOKEN);

                    await supabase.from('users').update({
                        membership_status: currentStatus,
                        last_membership_check: new Date().toISOString()
                    }).eq('id', user.id);

                } catch (e) {
                    const isTimeout = e.code === 'ETIMEDOUT' || e.message.includes('timeout');
                    console.error('Group check failed in middleware:', e.message);
                    return res.status(500).json({
                        error: isTimeout ? 'Telegram API Timeout. Silakan coba lagi nanti.' : 'Security check failed',
                        details: e.message
                    });
                }
            }

            if (!['creator', 'administrator', 'member'].includes(currentStatus)) {
                return res.status(403).json({ error: 'Jika sudah join silahkan buka ulang App' });
            }
        }

        // --- Paywall Gating Enforcer ---
        if (!isAdmin && paywallMode) {
            const actionToKey = {
                'analysis': 'analysis',
                'signal': 'signal',
                'fundamental': 'fundamental',
                'proxy': 'proxy',
                'profile': 'profile',
                'avg': 'avg',
                'review': 'review',
                'chart/live': 'chart-live',
                'chart': 'chart-data',
                'sectors': 'sectors'
            };

            const permissionKey = actionToKey[action];
            if (permissionKey && featurePermissions[permissionKey] === 'pro') {
                if (user.membership_status !== 'pro') {
                    return res.status(403).json({
                        error: 'Exclusive Feature',
                        code: 'PRO_REQUIRED',
                        hint: 'Upgrade ke PRO untuk mengakses fitur ini.'
                    });
                }
            }
        }

        // Log MiniApp Usage
        const username = user.telegram_username || `ID:${user.telegram_user_id}`;
        if (action) {
            console.log(`${username} menggunakan miniapp ${action}`);
        }

        // --- Dispatch to Controllers ---

        // 1. Try Admin Controller
        if (isAdmin) {
            const adminResponse = await handleAdminAction(req, res, action, user);
            if (adminResponse) return adminResponse;
        }

        // --- Fetch Limit Settings ---
        let limitChartMode = true; // Default ON if Paywall is ON
        let limitAIMode = true; // Default ON if Paywall is ON
        let limitAICount = 5;

        // Sync with Paywall Mode (Master Switch)
        if (!paywallMode) {
            limitChartMode = false;
            limitAIMode = false;
        } else {
            // Only read specific toggles if Paywall is ON
            if (settingsMap['limit_chart_mode'] !== undefined) limitChartMode = settingsMap['limit_chart_mode'];
            if (settingsMap['limit_ai_mode'] !== undefined) limitAIMode = settingsMap['limit_ai_mode'];
            if (settingsMap['limit_ai_count'] !== undefined) limitAICount = Number(settingsMap['limit_ai_count']);
        }

        // --- Fetch User Usage Stats ---
        // We need to re-fetch user to get 'daily_usage' JSONB column if it exists/changed
        // Or we can rely on what session gave us? Session usually joins users. 
        // Let's assume session.users has it. If not, we might fail a bit, but we can patch 'daily_usage' locally.

        // 2. Try Market Controller
        const marketResponse = await handleMarketAction(req, res, action, user, activeTheme, liveModeWhitelist, { limitChartMode, limitAIMode });
        if (marketResponse) return marketResponse;

        // 3. Fallback
        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('[WEB API CRITICAL ERROR]:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                error: 'Internal Server Error',
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join(' | ')
            });
        }
    }
};
