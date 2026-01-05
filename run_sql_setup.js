const { supabase } = require('./src/utils/supabase');
const fs = require('fs');
const path = require('path');

async function runSql() {
    const sqlPath = path.join(__dirname, 'create_watchlist_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running SQL...');
    // Supabase JS client doesn't support raw SQL query directly on public API easily without RPC.
    // BUT we can try using rpc if a function exists, OR just use pg client if we had it,
    // OR since I asked for DB connection permission, I can use a simpler approach:
    // Since I don't have direct SQL access setup via `pg` in the project yet (I installed it temporarily before but didn't verify env vars for connection string),
    // I will assume the user has a way to run it OR I will try to use a "hacky" way via a temporary RPC or simply rely on the user running it.

    // WAIT, I previously verified tables using supabase client.
    // Standard Supabase client cannot run CREATE TABLE.
    // I should ask the user to run it via dashboard OR use `pg` if connection string is available.

    // Let's check .env for connection string.
    require('dotenv').config();
    if (process.env.DATABASE_URL) {
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
        });
        try {
            await client.connect();
            await client.query(sql);
            console.log('✅ SQL executed successfully via pg client.');
            await client.end();
        } catch (e) {
            console.log('❌ Failed to run SQL via pg:', e.message);
            console.log('Please run create_watchlist_table.sql in Supabase Dashboard SQL Editor.');
        }
    } else {
        console.log('⚠️ DATABASE_URL not found. Please run create_watchlist_table.sql in Supabase Dashboard manually.');
    }
}

runSql();
