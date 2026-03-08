const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('vitest');
const request = require('supertest');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use test database URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test';

let pool;
let app;

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });

  // Run migrations
  const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);

  // Override the db/pool module to use test pool
  const dbPool = require('../../src/db/pool');
  dbPool.pool.end(); // close default pool
  Object.assign(dbPool, { pool, query: (text, params) => pool.query(text, params) });

  // Import app after pool override
  const appModule = require('../../src/index');
  app = appModule.app;
});

afterAll(async () => {
  if (pool) {
    await pool.query('DROP TABLE IF EXISTS clicks CASCADE');
    await pool.query('DROP TABLE IF EXISTS urls CASCADE');
    await pool.end();
  }
});

beforeEach(async () => {
  // Clean tables between tests
  await pool.query('DELETE FROM clicks');
  await pool.query('DELETE FROM urls');
});

describe('URL Creation (Integration)', () => {
  it('should create a URL and persist it in the database', async () => {
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBeTruthy();
    expect(res.body.original_url).toBe('https://example.com');

    // Verify it's in the database
    const dbResult = await pool.query('SELECT * FROM urls WHERE slug = $1', [res.body.slug]);
    expect(dbResult.rows).toHaveLength(1);
  });

  it('should create a URL with custom slug', async () => {
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'my-link' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('my-link');
  });

  it('should return 409 for duplicate custom slug', async () => {
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'taken' });

    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://other.com', customSlug: 'taken' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Slug already exists');
  });
});

describe('URL Redirect (Integration)', () => {
  it('should redirect and record a click', async () => {
    // Create URL first
    const createRes = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'redir-test' });

    expect(createRes.status).toBe(201);

    // Follow redirect
    const res = await request(app)
      .get('/api/urls/redir-test')
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com');

    // Verify click was recorded
    const urlRow = await pool.query('SELECT id FROM urls WHERE slug = $1', ['redir-test']);
    const clicks = await pool.query('SELECT * FROM clicks WHERE url_id = $1', [urlRow.rows[0].id]);
    expect(clicks.rows).toHaveLength(1);
  });

  it('should return 404 for unknown slug', async () => {
    const res = await request(app).get('/api/urls/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('URL Listing (Integration)', () => {
  it('should list all URLs with click counts', async () => {
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://one.com', customSlug: 'one-slug' });
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://two.com', customSlug: 'two-slug' });

    const res = await request(app).get('/api/urls');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('URL Deletion (Integration)', () => {
  it('should delete a URL and cascade delete clicks', async () => {
    // Create and click
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'del-test' });
    await request(app).get('/api/urls/del-test').redirects(0);

    // Delete
    const res = await request(app).delete('/api/urls/del-test');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    // Verify gone
    const dbResult = await pool.query('SELECT * FROM urls WHERE slug = $1', ['del-test']);
    expect(dbResult.rows).toHaveLength(0);

    // Verify clicks also gone (cascade)
    const clicks = await pool.query('SELECT * FROM clicks');
    expect(clicks.rows).toHaveLength(0);
  });

  it('should return 404 when deleting unknown slug', async () => {
    const res = await request(app).delete('/api/urls/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('URL Info (Integration)', () => {
  it('should return URL info without redirecting', async () => {
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'info-test' });

    const res = await request(app).get('/api/urls/info-test/info');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('info-test');
    expect(res.body.original_url).toBe('https://example.com');
  });
});
