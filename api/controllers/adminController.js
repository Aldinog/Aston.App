const { supabase } = require('../../src/utils/supabase');
const axios = require('axios');
const crypto = require('crypto');

async function handleAdminAction(req, res, action, user) {
    if (action === 'toggle-maintenance') {
        const { endTime } = req.body; // Expect ISO string or null
        // Fetch current state first
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').single();
        const isMaintenance = data ? data.value : false;

        const newState = !isMaintenance;

        // Prepare updates
        const updates = [
            { key: 'maintenance_mode', value: newState }
        ];

        if (newState && endTime) {
            updates.push({ key: 'maintenance_end_time', value: endTime });
        } else if (!newState) {
            // Clear time if turning off
            updates.push({ key: 'maintenance_end_time', value: null });
        }

        await supabase.from('app_settings').upsert(updates);

        // Return the new end_time so frontend can update immediately
        const returnedEndTime = newState ? endTime : null;
        return res.status(200).json({
            success: true,
            is_maintenance: newState,
            maintenance_end_time: returnedEndTime
        });
    }

    if (action === 'watchlist/list') {
        const { data, error } = await supabase.from('monitor_symbols').select('*').order('symbol');
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, data });
    }

    if (action === 'watchlist/add') {
        const { symbol: newSym } = req.body;
        if (!newSym) return res.status(400).json({ error: 'Symbol required' });
        const formattedSym = newSym.toUpperCase().endsWith('.JK') ? newSym.toUpperCase() : `${newSym.toUpperCase()}.JK`;
        const { error } = await supabase.from('monitor_symbols').insert([{ symbol: formattedSym, is_active: true }]);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    if (action === 'watchlist/delete') {
        const { symbol: targetSym } = req.body;
        await supabase.from('monitor_symbols').delete().eq('symbol', targetSym);
        return res.status(200).json({ success: true });
    }

    if (action === 'watchlist/toggle') {
        const { symbol: targetSym, is_active } = req.body;
        await supabase.from('monitor_symbols').update({ is_active }).eq('symbol', targetSym);
        return res.status(200).json({ success: true });
    }

    if (action === 'watchlist/batch-toggle') {
        const { is_active } = req.body;
        const { error } = await supabase.from('monitor_symbols').update({ is_active }).not('symbol', 'is', null);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/force-scan') {
        // For architecture simplicity, we'll try to trigger the internal logic
        // We need to require relatively from here. api/controllers/ -> api/cron/scanner is ../../api/cron/scanner
        const scanner = require('../../api/cron/scanner');
        const mockReq = { body: {} };
        const mockRes = {
            status: (code) => ({ json: (data) => { console.log('Mock Scanner Finish:', data); } })
        };
        scanner(mockReq, mockRes);
        return res.status(200).json({ success: true, message: 'Scanner triggered in background' });
    }

    if (action === 'admin/update-theme') {
        const { theme } = req.body;
        await supabase.from('app_settings').upsert({ key: 'active_theme', value: theme });
        return res.status(200).json({ success: true, theme });
    }

    if (action === 'admin/users/list') {
        console.log('[ADMIN] Fetching users list...');
        const { data, error } = await supabase
            .from('users')
            .select('id, telegram_user_id, telegram_username, is_live_eligible, is_active, membership_status, expires_at, last_seen_at');

        if (error) {
            console.error('[ADMIN] Fetch Users Error:', error);
            return res.status(400).json({ error: error.message, details: error });
        }
        return res.status(200).json({ success: true, data });
    }

    if (action === 'admin/users/toggle-live') {
        const { userId, is_live_eligible } = req.body;
        const { error } = await supabase.from('users').update({ is_live_eligible }).eq('id', userId);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/users/add') {
        const { telegram_user_id } = req.body;
        if (!telegram_user_id) return res.status(400).json({ error: 'Telegram User ID is required' });

        console.log(`[ADMIN] Adding user manual: ${telegram_user_id}`);

        // Create initial expires_at (e.g., 3 days from now)
        const expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + 3);

        const placeholderHash = crypto.randomBytes(16).toString('hex');

        const payload = {
            telegram_user_id: telegram_user_id.toString(),
            is_active: true,
            is_live_eligible: true,
            expires_at: expires_at.toISOString(),
            membership_status: 'member',
            password_hash: placeholderHash,
            last_login: new Date().toISOString()
        };

        console.log(`[ADMIN] Upsert Payload:`, payload);

        const { data: upsertData, error: upsertError } = await supabase.from('users').upsert([payload], { onConflict: 'telegram_user_id' });

        if (upsertError) {
            console.error(`[ADMIN] Upsert Error:`, upsertError);
            return res.status(400).json({ error: upsertError.message, details: upsertError });
        }

        console.log(`[ADMIN] User added successfully:`, telegram_user_id);
        return res.status(200).json({ success: true });
    }

    // --- NEW ADMIN SUBSCRIPTION ACTIONS ---
    if (action === 'admin/users/extend') {
        const { userId, days } = req.body;
        if (!userId || !days) return res.status(400).json({ error: 'UserID and Days required' });

        // Fetch current expiry
        const { data: u } = await supabase.from('users').select('expires_at').eq('id', userId).single();
        if (!u) return res.status(404).json({ error: 'User not found' });

        const current = new Date(u.expires_at || new Date());
        const base = current < new Date() ? new Date() : current;
        const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

        const { error } = await supabase.from('users').update({ expires_at: newExpiry.toISOString() }).eq('id', userId);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true, expires_at: newExpiry.toISOString() });
    }

    if (action === 'admin/users/update-level') {
        const { userId, level } = req.body; // 'standard' or 'pro'
        if (!userId || !level) return res.status(400).json({ error: 'UserID and Level required' });

        const { error } = await supabase.from('users').update({ membership_status: level }).eq('id', userId);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/users/set-expiry') {
        const { userId, expiryDate } = req.body; // ISO string
        if (!userId || !expiryDate) return res.status(400).json({ error: 'UserID and ExpiryDate required' });

        const { error } = await supabase.from('users').update({ expires_at: expiryDate }).eq('id', userId);
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/settings/update-paywall') {
        const { paywall_mode } = req.body;
        await supabase.from('app_settings').upsert({ key: 'paywall_mode', value: paywall_mode });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/settings/update-permissions') {
        const { permissions } = req.body; // Object mapping feature keys to 'standard'/'pro'
        await supabase.from('app_settings').upsert({ key: 'feature_permissions', value: permissions });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/settings/get-whitelist') {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_whitelist').single();
        return res.status(200).json({ success: true, whitelist: data ? data.value : [] });
    }

    if (action === 'admin/settings/update-whitelist') {
        const { whitelist } = req.body;
        await supabase.from('app_settings').upsert({ key: 'maintenance_whitelist', value: whitelist });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/settings/get-live-whitelist') {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'live_mode_whitelist').single();
        return res.status(200).json({ success: true, whitelist: data ? data.value : [] });
    }

    if (action === 'admin/settings/update-live-whitelist') {
        const { whitelist } = req.body;
        await supabase.from('app_settings').upsert({ key: 'live_mode_whitelist', value: whitelist });
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/settings/get-cooldown') {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'cooldown_mode').single();
        const { data: timeData } = await supabase.from('app_settings').select('value').eq('key', 'cooldown_end_time').single();
        return res.status(200).json({
            success: true,
            is_cooldown: data ? data.value : false,
            cooldown_end_time: timeData ? timeData.value : null
        });
    }

    if (action === 'admin/settings/toggle-cooldown') {
        const { is_cooldown } = req.body;
        let endTime = null;
        if (is_cooldown) {
            // Set cooldown for 30 minutes
            endTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }
        await supabase.from('app_settings').upsert([
            { key: 'cooldown_mode', value: is_cooldown },
            { key: 'cooldown_end_time', value: endTime }
        ]);
        return res.status(200).json({ success: true, cooldown_end_time: endTime });
    }

    if (action === 'admin/settings/get-limit-config') {
        const keys = ['limit_chart_mode', 'limit_ai_mode', 'limit_ai_count'];
        const { data } = await supabase.from('app_settings').select('key, value').in('key', keys);

        const config = {
            limit_chart_mode: true,
            limit_ai_mode: true,
            limit_ai_count: 5 // Default
        };

        if (data) {
            data.forEach(item => {
                config[item.key] = item.value;
            });
        }
        return res.status(200).json({ success: true, config });
    }

    if (action === 'admin/settings/update-limit-config') {
        const { limit_chart_mode, limit_ai_mode, limit_ai_count } = req.body;

        const updates = [];
        if (limit_chart_mode !== undefined) updates.push({ key: 'limit_chart_mode', value: limit_chart_mode });
        if (limit_ai_mode !== undefined) updates.push({ key: 'limit_ai_mode', value: limit_ai_mode });
        if (limit_ai_count !== undefined) updates.push({ key: 'limit_ai_count', value: limit_ai_count });

        if (updates.length > 0) {
            await supabase.from('app_settings').upsert(updates);
        }
        return res.status(200).json({ success: true });
    }

    if (action === 'admin/diagnostics/ip-status') {
        try {
            const ipRes = await axios.get('https://api.ipify.org?format=json');
            const ip = ipRes.data.ip;
            // Dummy check YF
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'cooldown_mode').single();
            return res.status(200).json({
                success: true,
                ip: ip,
                yf_status: (data && data.value) ? 'COOLING DOWN' : 'OK'
            });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    if (action === 'admin/diagnostics/check-connection') {
        try {
            const { fetchQuote } = require('../../src/utils/yahoofinance');
            const quote = await fetchQuote('BBCA.JK');
            const ok = !!quote;
            return res.status(200).json({
                success: true,
                yf_status: ok ? 'OK' : 'BLOCKED/ERROR'
            });
        } catch (e) {
            return res.json({ success: true, yf_status: 'ERROR: ' + e.message });
        }
    }

    return null; // Not an admin action
}

module.exports = { handleAdminAction };
