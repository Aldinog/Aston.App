const { supabase } = require('../../src/utils/supabase');

// Helper: Check event status
// Helper: Check event status
async function getEventStatus() {
    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'event_status')
        .single();

    if (!data || !data.value) return 'open';

    // Normalize: Remove extra quotes if stored as '"open"' string
    let status = data.value;
    if (typeof status === 'string') {
        status = status.replace(/^"|"$/g, '');
    }
    return status;
}

// 1. Register Participant
exports.registerParticipant = async (req, res) => {
    try {
        const { full_name, telegram_username, city, province, telegram_user_id } = req.body;

        // Basic Validation
        if (!full_name || !telegram_username || !city || !province || !telegram_user_id) {
            return res.status(400).json({ error: 'Data tidak lengkap.' });
        }

        // Check Event Status
        const status = await getEventStatus();
        console.log(`[REGISTRATION CHECK] Status from DB: ${status} (Type: ${typeof status})`);

        if (status === 'closed' || status === 'announcement' || status === 'off') {
            console.log('[REGISTRATION BLOCKED] Event is closed.');
            return res.status(400).json({ error: 'Pendaftaran event sudah ditutup.' });
        }

        // Check Duplicate
        const { data: existing } = await supabase
            .from('event_participants')
            .select('id')
            .eq('telegram_user_id', telegram_user_id)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Anda sudah terdaftar!' });
        }

        // Insert Data
        const { error } = await supabase
            .from('event_participants')
            .insert([{
                full_name,
                telegram_username: telegram_username.startsWith('@') ? telegram_username : `@${telegram_username}`,
                city,
                province,
                telegram_user_id: String(telegram_user_id)
            }]);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Registrasi berhasil!' });

    } catch (err) {
        console.error('[EVENT REG CHECK]', err);
        return res.status(500).json({ error: 'Terjadi kesalahan sistem.' });
    }
};

// 2. Get Participants (Public)
exports.getParticipants = async (req, res) => {
    try {
        // Fetch only usernames
        const { data, error } = await supabase
            .from('event_participants')
            .select('telegram_username, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch Event Status & Winners
        const status = await getEventStatus();

        // If Announcement mode, fetch winners
        let winners = [];
        if (status === 'announcement') {
            const { data: winnerData } = await supabase
                .from('event_participants')
                .select('telegram_username, win_rank')
                .eq('is_winner', true)
                .order('win_rank', { ascending: true });
            winners = winnerData || [];
        }

        return res.status(200).json({
            success: true,
            participants: data,
            status: status,
            winners: winners
        });

    } catch (err) {
        console.error('[EVENT LIST]', err);
        return res.status(500).json({ error: 'Gagal memuat data.' });
    }
};

// 3. Admin Control (Status & Winners)
exports.adminControl = async (req, res) => {
    try {
        // Auth check should be done in router middleware
        const { action, payload } = req.body;

        if (action === 'set_status') {
            // payload: { status: 'open' | 'closed' | 'announcement' }
            // Store as JSON string to be safe with JSONB, but helper will clean it.
            await supabase
                .from('app_settings')
                .upsert({ key: 'event_status', value: JSON.stringify(payload.status) });

            // Log for debug
            console.log(`[EVENT STATUS] Set to ${payload.status}`);

            return res.json({ success: true, message: `Status updated to ${payload.status}` });
        }

        if (action === 'set_winners') {
            // payload: { winners: ['@a', '@b', ...] }
            // 1. Reset current winners
            await supabase
                .from('event_participants')
                .update({ is_winner: false, win_rank: 0 })
                .gt('id', 0); // All rows

            // 2. Set new winners
            const winners = payload.winners; // Array of usernames
            let winnersFound = 0;
            const notFound = [];

            for (let i = 0; i < winners.length; i++) {
                let username = winners[i].trim();
                if (!username) continue;
                // Normalize: Ensure starts with @
                if (!username.startsWith('@')) username = '@' + username;

                // Try case-insensitive usage with text search filter or ilike
                // Supabase JS ilike syntax: .ilike('column', 'pattern')
                const { data } = await supabase
                    .from('event_participants')
                    .update({ is_winner: true, win_rank: i + 1 })
                    .ilike('telegram_username', username)
                    .select();

                if (data && data.length > 0) {
                    winnersFound++;
                } else {
                    notFound.push(username);
                }
            }

            // Auto switch to announcement
            await supabase
                .from('app_settings')
                .upsert({ key: 'event_status', value: JSON.stringify('announcement') });

            let msg = `Pemenang diumumkan! (${winnersFound} dari ${winners.length} ditemukan)`;
            if (notFound.length > 0) {
                msg += `. PERINGATAN: Username ini tidak terdaftar sebagai peserta: ${notFound.join(', ')}`;
            }

            return res.json({ success: true, message: msg });

            // Auto switch to announcement
            await supabase
                .from('app_settings')
                .upsert({ key: 'event_status', value: JSON.stringify('announcement') });

            return res.json({ success: true, message: 'Pemenang diumumkan!' });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (err) {
        console.error('[EVENT ADMIN]', err);
        return res.status(500).json({ error: err.message });
    }
};

// 4. Admin Export
exports.exportParticipants = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('event_participants')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({ success: true, data });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
