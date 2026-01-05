const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.END_POINT;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SECRET;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ SUPABASE_URL (END_POINT) or SUPABASE_SERVICE_ROLE_KEY (SECRET) is missing in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
