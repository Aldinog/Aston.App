const { validateTelegramInitData } = require('../../src/utils/auth');
const { supabase } = require('../../src/utils/supabase');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

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

    const { initData } = req.body;

    if (!initData) {
        return res.status(400).json({ error: 'initData is required' });
    }

    // 1. Validate initData
    const telegramUser = validateTelegramInitData(initData);
    if (!telegramUser) {
        return res.status(401).json({ error: 'Invalid Telegram data' });
    }

    const telegram_user_id = telegramUser.id;
    const telegram_username = telegramUser.username;

    try {
        // 2. Check group membership
        // Ensure bot is an admin in the group
        if (!process.env.TELEGRAM_TOKEN) {
            return res.status(500).json({ error: 'System configuration error: TELEGRAM_TOKEN not set' });
        }

        const groupIds = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
        if (groupIds.length === 0) {
            return res.status(500).json({ error: 'System configuration error: Group IDs not set' });
        }

        let isMember = false;
        // Check membership in the first allowed group (Aston Group)
        const primaryGroupId = groupIds[0];

        try {
            const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getChatMember`, {
                params: {
                    chat_id: primaryGroupId,
                    user_id: telegram_user_id
                }
            });

            const status = response.data.result.status;
            // allowed statuses: creator, administrator, member
            if (['creator', 'administrator', 'member'].includes(status)) {
                isMember = true;
            }
        } catch (error) {
            console.error('Telegram getChatMember error:', error.response?.data || error.message);
            return res.status(403).json({ error: 'Unable to verify group membership' });
        }

        if (!isMember) {
            return res.status(403).json({
                error: 'Silahkan join grup dulu untuk akses bot',
                code: 'NOT_MEMBER'
            });
        }

        // 3. User Registration/Update Logic
        // Find user or create
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_user_id', telegram_user_id)
            .single();

        let targetUser = user;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

        if (userError && userError.code === 'PGRST116') {
            // User not found, create new
            const crypto = require('crypto');
            const randomPassword = crypto.randomBytes(16).toString('hex');

            // NEW LOGIC: Standard user = Lifetime Access (null expiry)
            // Membership status default 'member' (standard)
            const payload = {
                telegram_user_id,
                telegram_username,
                password_hash: randomPassword,
                expires_at: null, // No expiry for standard
                last_login: now.toISOString(),
                membership_status: 'member'
            };

            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([payload])
                .select()
                .single();

            if (insertError) throw insertError;
            targetUser = newUser;
        } else if (user) {
            // User exists
            const updateData = {
                last_login: now.toISOString(),
                telegram_username
            };

            // If user is PRO, check expiry and downgrade if needed
            if (user.membership_status === 'pro' && user.expires_at && new Date(user.expires_at) < now) {
                // Downgrade to Standard (Lifetime)
                console.log(`[AUTH] User ${user.telegram_user_id} PRO expired. Downgrading to standard (Lifetime).`);
                updateData.membership_status = 'standard';
                updateData.expires_at = null; // Infinite
            }

            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', user.id)
                .select()
                .single();

            if (updateError) throw updateError;
            targetUser = updatedUser;
        } else {
            throw userError;
        }

        // 4. Double check expiry strictly (Only for PRO valid check, or legacy)
        // If Standard (expires_at is null), allow.
        if (targetUser.membership_status === 'pro' && targetUser.expires_at && new Date(targetUser.expires_at) < now) {
            // Should be downgraded already, but just in case
            // Auto-downgrade block handled above, so this might be redundant or for edge cases.
            // We allow login as standard now.
        }

        // --- FETCH APP SETTINGS (Maintenance, Theme, Paywall) ---
        let maintenanceMode = false;
        let maintenanceEndTime = null;
        let activeTheme = 'default';
        let paywallMode = false;
        let featurePermissions = {};

        const { data: appSettings } = await supabase
            .from('app_settings')
            .select('key, value');

        if (appSettings) {
            const modeSetting = appSettings.find(s => s.key === 'maintenance_mode');
            const endSetting = appSettings.find(s => s.key === 'maintenance_end_time');
            const themeSetting = appSettings.find(s => s.key === 'active_theme');
            const paywallSetting = appSettings.find(s => s.key === 'paywall_mode');
            const permsSetting = appSettings.find(s => s.key === 'feature_permissions');

            if (modeSetting) maintenanceMode = modeSetting.value;
            if (endSetting) maintenanceEndTime = endSetting.value;
            if (themeSetting) activeTheme = themeSetting.value;
            if (paywallSetting) paywallMode = paywallSetting.value;
            if (permsSetting) featurePermissions = permsSetting.value;
        }

        const isAdmin = process.env.ADMIN_ID && targetUser.telegram_user_id.toString() === process.env.ADMIN_ID.toString();
        // Optional: Add whitelist logic here if needed, for now assume only Admin is whitelisted in maintenance
        const isWhitelisted = isAdmin;

        // Auto-Disable Logic (Sync with web.js)
        if (maintenanceMode && maintenanceEndTime) {
            const nowCheck = new Date();
            const end = new Date(maintenanceEndTime);
            if (nowCheck >= end) {
                // Auto Turn Off
                await supabase.from('app_settings').upsert([
                    { key: 'maintenance_mode', value: false },
                    { key: 'maintenance_end_time', value: null }
                ]);
                maintenanceMode = false;
                maintenanceEndTime = null;
            }
        }

        // BLOCKING LOGIC: If Maintenance is ON and NOT Admin and NOT Whitelisted
        if (maintenanceMode && !isAdmin && !isWhitelisted) {
            return res.status(503).json({
                error: 'Mohon maaf APP masih maintenance',
                code: 'MAINTENANCE_MODE',
                end_time: maintenanceEndTime // Return time for countdown
            });
        }

        // 6. Generate Session Token (JWT)
        const tokenToken = jwt.sign(
            { id: targetUser.id, telegram_user_id: targetUser.telegram_user_id, is_admin: isAdmin },
            process.env.JWT_SECRET || 'fallback-secret-aston',
            { expiresIn: '3d' }
        );

        // Store session in database (optional but requested in schema)
        await supabase
            .from('sessions')
            .insert([{
                user_id: targetUser.id,
                token: tokenToken,
                expires_at: expiresAt.toISOString()
            }]);

        return res.status(200).json({
            success: true,
            token: tokenToken,
            user: {
                id: targetUser.id,
                telegram_user_id: targetUser.telegram_user_id,
                username: targetUser.telegram_username,
                expires_at: targetUser.expires_at,
                is_maintenance: maintenanceMode,
                maintenance_end_time: maintenanceEndTime,
                is_admin: isAdmin,
                active_theme: activeTheme,
                membership_status: targetUser.membership_status,
                paywall_mode: paywallMode,
                feature_permissions: featurePermissions
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message || error,
            hint: 'Check if you have run the SQL initialization in Supabase and set all environment variables in Vercel.'
        });
    }
};
