const { Pool } = require('pg');

const isSupabase = /supabase\.co/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSupabase ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
