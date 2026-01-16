require('dotenv').config({ path: '../.env' }); // Adjust path if running from 'scripts' folder
const { supabase } = require('../src/utils/supabase');
const { broadcastNotification } = require('../src/utils/notification');

async function runTest() {
    console.log('🚀 Starting Manual Push Notification Test...');

    // 1. Cek User Tokens
    const { data: users, error } = await supabase
        .from('users')
        .select('email, push_token')
        .not('push_token', 'is', null);

    if (error) {
        console.error('❌ Database Error:', error.message);
        return;
    }

    if (!users || users.length === 0) {
        console.warn('⚠️ Tidak ada user dengan push_token di database.');
        console.warn('SARAN: Login di aplikasi Mobile (Expo Go) dulu agar token tersimpan.');
        return;
    }

    console.log(`✅ Ditemukan ${users.length} user dengan token.`);
    users.forEach(u => console.log(`   - ${u.email} (Token: ${u.push_token.substring(0, 20)}...)`));

    // 2. Kirim Notif
    console.log('\n📨 Sending Test Notification...');
    await broadcastNotification(
        "🔔 Test Notifikasi Aston",
        "Jika anda membaca ini, sistem notifikasi berhasil! ✅",
        { test: true }
    );

    console.log('Done.');
}

runTest();
