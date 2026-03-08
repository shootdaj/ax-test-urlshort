const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);
  console.log('Database migrations completed');
}

module.exports = { runMigrations };
