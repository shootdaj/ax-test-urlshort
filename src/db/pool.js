const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/urlshort',
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { pool, query };
