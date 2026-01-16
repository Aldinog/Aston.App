const { supabase } = require('../utils/supabase');
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

        // --- Authentication Middleware (Dual Strategy) ---
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('[WEB API] Unauthorized: Missing token');
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }

        const token = authHeader.split(' ')[1];
        let userUser = null;
        let isLegacy = false;

        // Strategy 1: Legacy Telegram JWT (Custom Signed)
        try {
            if (process.env.JWT_SECRET) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                // Check session in DB
                const { data: session } = await supabase
                    .from('sessions')
                    .select('user_id, users(*)')
                    .eq('token', token)
                    .single();

                if (session && session.users && session.users.is_active) {
                    userUser = session.users;
                    isLegacy = true;
                    // Log Last Seen
                    supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userUser.id).then();
                }
            }
        } catch (legacyErr) {
            // Ignore legacy error, try Supabase Auth
        }

        // Strategy 2: Supabase Auth (Email/Google)
        if (!userUser) {
            console.log('[AUTH DEBUG] Attempting Supabase Auth Strategy...');
            const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);

            if (sbError) console.error('[AUTH DEBUG] getUser Error:', sbError.message);
            if (sbUser) console.log('[AUTH DEBUG] sbUser found:', sbUser.email, sbUser.id);

            if (sbUser && !sbError) {
                const email = sbUser.email;
                const sbId = sbUser.id;

                // Sync with public.users
                // 1. Try finding by supabase_user_id
                let { data: pUser, error: findError } = await supabase.from('users').select('*').eq('supabase_user_id', sbId).single();

                if (findError && findError.code !== 'PGRST116') console.error('[AUTH DEBUG] Find by sbId Error:', findError.message);

                // 2. If not found, try finding by Email (Legacy link)
                if (!pUser && email) {
                    console.log('[AUTH DEBUG] Linking via Email...');
                    const { data: emailUser } = await supabase.from('users').select('*').eq('email', email).single();
                    if (emailUser) {
                        // Link account
                        await supabase.from('users').update({ supabase_user_id: sbId }).eq('id', emailUser.id);
                        pUser = emailUser;
                        console.log('[AUTH DEBUG] Linked/Found by Email.');
                    }
                }

                // 3. If still not found, Create New User
                if (!pUser) {
                    console.log(`[AUTH DEBUG] Creating new user for: ${email}`);
                    try {
                        const { data: newUser, error: createError } = await supabase.from('users').insert([{
                            email: email,
                            supabase_user_id: sbId,
                            membership_status: 'member',
                            last_login: new Date().toISOString(),
                            is_active: true
                        }]).select().single();

                        if (createError) {
                            console.error('[AUTH DEBUG] Creation Failed:', createError.message, createError.details);
                        } else {
                            pUser = newUser;
                            console.log('[AUTH DEBUG] User Created:', pUser.id);
                        }
                    } catch (createErr) {
                        console.error('[AUTH DEBUG] Exception during creation:', createErr.message);
                    }
                }

                if (pUser && pUser.is_active) {
                    userUser = pUser;
                    // Update last login
                    supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', pUser.id).then();
                } else {
                    console.log('[AUTH DEBUG] User Resolving Failed. pUser:', pUser);
                }
            }
        }

        if (!userUser) {
            console.warn('[AUTH FAILURE] userUser is null after strategies.');
            return res.status(401).json({ error: 'Unauthorized: Invalid Token or User not found.' });
        }

        const user = userUser;
        const isAdmin = (user.telegram_user_id && user.telegram_user_id.toString() === (process.env.ADMIN_ID || '')) || false;

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
        const isWhitelisted = user.telegram_user_id && maintenanceWhitelist.includes(user.telegram_user_id.toString());

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
                        expires_at: new Date('9999-12-31').toISOString() // Infinite
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
            // Only check Telegram Group if user HAS telegram_user_id
            if (user.telegram_user_id && (currentStatus !== 'member' || isExpired)) {
                const groupIds = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
                const primaryGroupId = groupIds[0];
                try {
                    currentStatus = await checkTelegramMembership(user.telegram_user_id, primaryGroupId, process.env.TELEGRAM_TOKEN);

                    await supabase.from('users').update({
                        membership_status: currentStatus,
                        last_membership_check: new Date().toISOString()
                    }).eq('id', user.id);

                } catch (e) {
                    // Log but allow soft fail if it's just timeout? Strict for now.
                    console.error('Group check failed:', e.message);
                }
            }

            if (!['creator', 'administrator', 'member'].includes(currentStatus)) {
                return res.status(403).json({ error: 'Akses Ditolak. (Membership Invalid)' });
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
        const marketResponse = await handleMarketAction(req, res, action, user, activeTheme, liveModeWhitelist, { limitChartMode, limitAIMode, limitAICount });
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
