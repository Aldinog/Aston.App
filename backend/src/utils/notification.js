const { Expo } = require('expo-server-sdk');
const { supabase } = require('./supabase');

const expo = new Expo();

/**
 * Broadcast a push notification to all users with valid tokens.
 * @param {string} title - The title of the notification
 * @param {string} body - The body text of the notification
 * @param {object} data - Optional data payload
 */
async function broadcastNotification(title, body, data = {}) {
    try {
        // 1. Fetch valid tokens from DB
        const { data: users, error } = await supabase
            .from('users')
            .select('push_token')
            .not('push_token', 'is', null);

        if (error) throw error;
        if (!users || users.length === 0) {
            console.log('[NOTIF] No users with push tokens found.');
            return;
        }

        // 2. Construct messages
        let messages = [];
        for (const user of users) {
            const pushToken = user.push_token;
            if (!Expo.isExpoPushToken(pushToken)) {
                console.error(`[NOTIF] Invalid token: ${pushToken}`);
                continue;
            }

            messages.push({
                to: pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: data,
            });
        }

        // 3. Send in chunks
        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];

        for (const chunk of chunks) {
            try {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('[NOTIF] Error sending chunk:', error);
            }
        }

        console.log(`[NOTIF] Sent ${messages.length} notifications.`);

        // (Optional) Handle receipt errors here if needed later

    } catch (e) {
        console.error('[NOTIF] Broadcast Error:', e);
    }
}

module.exports = { broadcastNotification };
