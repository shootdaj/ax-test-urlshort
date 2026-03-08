const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('vitest');
const request = require('supertest');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
  // Only close and reassign if not already done by integration tests
  if (dbPool.pool !== pool) {
    try { dbPool.pool.end(); } catch (e) { /* already closed */ }
    Object.assign(dbPool, { pool, query: (text, params) => pool.query(text, params) });
  }

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
  await pool.query('DELETE FROM clicks');
  await pool.query('DELETE FROM urls');
});

describe('Scenario: Full URL shortening workflow', () => {
  it('should create, redirect, verify click, and delete', async () => {
    // Step 1: Create short URL
    const createRes = await request(app)
      .post('/api/urls')
      .send({ url: 'https://github.com/example', customSlug: 'gh-example' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.slug).toBe('gh-example');

    // Step 2: Visit the short URL (redirect)
    const redirectRes = await request(app)
      .get('/api/urls/gh-example')
      .redirects(0);
    expect(redirectRes.status).toBe(301);
    expect(redirectRes.headers.location).toBe('https://github.com/example');

    // Step 3: Verify click was recorded
    const infoRes = await request(app).get('/api/urls/gh-example/info');
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.slug).toBe('gh-example');

    // Verify click in DB directly
    const urlRow = await pool.query('SELECT id FROM urls WHERE slug = $1', ['gh-example']);
    const clicks = await pool.query('SELECT * FROM clicks WHERE url_id = $1', [urlRow.rows[0].id]);
    expect(clicks.rows.length).toBeGreaterThanOrEqual(1);

    // Step 4: Delete the URL
    const deleteRes = await request(app).delete('/api/urls/gh-example');
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);

    // Step 5: Verify URL is gone
    const afterDelete = await request(app).get('/api/urls/gh-example');
    expect(afterDelete.status).toBe(404);
  });
});

describe('Scenario: Custom slug with conflict handling', () => {
  it('should create with custom slug, detect conflict, then succeed with different slug', async () => {
    // Step 1: Create with custom slug
    const first = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'my-link' });
    expect(first.status).toBe(201);

    // Step 2: Try to create with same slug -- should get 409
    const conflict = await request(app)
      .post('/api/urls')
      .send({ url: 'https://other.com', customSlug: 'my-link' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toBe('Slug already exists');

    // Step 3: Create with different slug -- should succeed
    const second = await request(app)
      .post('/api/urls')
      .send({ url: 'https://other.com', customSlug: 'other-link' });
    expect(second.status).toBe(201);
    expect(second.body.slug).toBe('other-link');

    // Step 4: Both URLs should work
    const redirect1 = await request(app).get('/api/urls/my-link').redirects(0);
    expect(redirect1.status).toBe(301);
    expect(redirect1.headers.location).toBe('https://example.com');

    const redirect2 = await request(app).get('/api/urls/other-link').redirects(0);
    expect(redirect2.status).toBe(301);
    expect(redirect2.headers.location).toBe('https://other.com');
  });
});

describe('Scenario: Input validation protects the system', () => {
  it('should reject invalid inputs at every step', async () => {
    // Missing URL
    const noUrl = await request(app).post('/api/urls').send({});
    expect(noUrl.status).toBe(400);

    // Invalid URL format
    const badUrl = await request(app).post('/api/urls').send({ url: 'not-a-url' });
    expect(badUrl.status).toBe(400);

    // Non-http protocol
    const ftpUrl = await request(app).post('/api/urls').send({ url: 'ftp://files.com/data' });
    expect(ftpUrl.status).toBe(400);

    // Slug too short
    const shortSlug = await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'ab' });
    expect(shortSlug.status).toBe(400);

    // Slug with bad characters
    const badSlug = await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'has spaces' });
    expect(badSlug.status).toBe(400);

    // Valid request should still work after all rejections
    const valid = await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'good-slug' });
    expect(valid.status).toBe(201);
  });
});
