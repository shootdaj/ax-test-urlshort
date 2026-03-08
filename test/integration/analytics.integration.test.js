const request = require('supertest');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test';

let testPool;
let app;

beforeAll(async () => {
  testPool = new Pool({ connectionString: DATABASE_URL });

  // Run migrations
  const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await testPool.query(sql);

  // Add browser/os columns if not present (in case older schema)
  await testPool.query(`
    DO $$ BEGIN
      ALTER TABLE clicks ADD COLUMN IF NOT EXISTS browser VARCHAR(50);
      ALTER TABLE clicks ADD COLUMN IF NOT EXISTS os VARCHAR(50);
    END $$;
  `);

  // Override the db module's query and pool to use test pool
  const db = require('../../src/db/pool');
  db.query = (text, params) => testPool.query(text, params);
  db.pool = testPool;

  const appModule = require('../../src/index');
  app = appModule.app;
});

afterAll(async () => {
  if (testPool) {
    await testPool.query('DROP TABLE IF EXISTS clicks CASCADE');
    await testPool.query('DROP TABLE IF EXISTS urls CASCADE');
    await testPool.end();
  }
});

beforeEach(async () => {
  await testPool.query('DELETE FROM clicks');
  await testPool.query('DELETE FROM urls');
});

describe('Global Analytics (Integration)', () => {
  it('should return global summary with totals', async () => {
    // Create two URLs
    await request(app).post('/api/urls').send({ url: 'https://one.com', customSlug: 'one-analytics' });
    await request(app).post('/api/urls').send({ url: 'https://two.com', customSlug: 'two-analytics' });

    // Click them
    await request(app).get('/api/urls/one-analytics').redirects(0);
    await request(app).get('/api/urls/one-analytics').redirects(0);
    await request(app).get('/api/urls/two-analytics').redirects(0);

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
    expect(res.body.total_urls).toBe(2);
    expect(res.body.total_clicks).toBe(3);
    expect(res.body.top_urls).toHaveLength(2);
    expect(res.body.top_urls[0].slug).toBe('one-analytics'); // most clicks first
  });

  it('should return empty data when no URLs exist', async () => {
    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
    expect(res.body.total_urls).toBe(0);
    expect(res.body.total_clicks).toBe(0);
    expect(res.body.top_urls).toHaveLength(0);
  });
});

describe('Per-URL Analytics (Integration)', () => {
  it('should return analytics with unique visitors and browser breakdown', async () => {
    // Create URL
    await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'analytics-test' });

    // Simulate clicks with different user agents
    await request(app)
      .get('/api/urls/analytics-test')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0')
      .redirects(0);
    await request(app)
      .get('/api/urls/analytics-test')
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/121.0')
      .redirects(0);

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await request(app).get('/api/analytics/analytics-test');
    expect(res.status).toBe(200);
    expect(res.body.analytics.total_clicks).toBe(2);
    expect(res.body.analytics.unique_visitors).toBeGreaterThanOrEqual(1);
    expect(res.body.analytics.clicks_by_day).toHaveLength(1); // all on same day
    expect(res.body.analytics.browser_breakdown.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 404 for unknown slug', async () => {
    const res = await request(app).get('/api/analytics/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });

  it('should support date range filtering', async () => {
    // Create URL and clicks
    await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'date-filter-test' });
    await request(app).get('/api/urls/date-filter-test').redirects(0);

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Filter with today's date range
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app).get(`/api/analytics/date-filter-test?start=${today}&end=${today}`);
    expect(res.status).toBe(200);
    expect(res.body.analytics.total_clicks).toBe(1);
  });

  it('should return 400 for invalid date format', async () => {
    const res = await request(app).get('/api/analytics/any-slug?start=bad-date');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid start date');
  });
});

describe('Click Recording with Metadata (Integration)', () => {
  it('should store browser and OS from user-agent', async () => {
    await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'meta-test' });

    await request(app)
      .get('/api/urls/meta-test')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      .redirects(0);

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check the click was recorded with parsed metadata
    const urlRow = await testPool.query('SELECT id FROM urls WHERE slug = $1', ['meta-test']);
    const clicks = await testPool.query('SELECT * FROM clicks WHERE url_id = $1', [urlRow.rows[0].id]);
    expect(clicks.rows).toHaveLength(1);
    expect(clicks.rows[0].browser).toBe('Chrome');
    expect(clicks.rows[0].os).toBe('Windows');
  });

  it('should store referrer when present', async () => {
    await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'ref-test' });

    await request(app)
      .get('/api/urls/ref-test')
      .set('Referer', 'https://google.com/search?q=test')
      .redirects(0);

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 100));

    const urlRow = await testPool.query('SELECT id FROM urls WHERE slug = $1', ['ref-test']);
    const clicks = await testPool.query('SELECT * FROM clicks WHERE url_id = $1', [urlRow.rows[0].id]);
    expect(clicks.rows).toHaveLength(1);
    expect(clicks.rows[0].referrer).toBe('https://google.com/search?q=test');
  });
});
