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

  // Add browser/os columns if not present
  await testPool.query(`
    DO $$ BEGIN
      ALTER TABLE clicks ADD COLUMN IF NOT EXISTS browser VARCHAR(50);
      ALTER TABLE clicks ADD COLUMN IF NOT EXISTS os VARCHAR(50);
    END $$;
  `);

  // Override the db module
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

describe('Scenario: Complete analytics workflow', () => {
  it('should create URL, generate clicks from various sources, then view analytics', async () => {
    // Step 1: Create a short URL
    const createRes = await request(app)
      .post('/api/urls')
      .send({ url: 'https://docs.example.com/getting-started', customSlug: 'docs' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.slug).toBe('docs');

    // Step 2: Simulate clicks from different browsers and referrers
    const clicks = [
      { ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36', referrer: 'https://google.com' },
      { ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36', referrer: 'https://google.com' },
      { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/121.0', referrer: 'https://twitter.com' },
      { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2) Safari/605.1.15 Version/17.2', referrer: null },
    ];

    for (const click of clicks) {
      const req = request(app).get('/api/urls/docs').redirects(0);
      req.set('User-Agent', click.ua);
      if (click.referrer) req.set('Referer', click.referrer);
      const res = await req;
      expect(res.status).toBe(301);
    }

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Step 3: View per-URL analytics
    const analyticsRes = await request(app).get('/api/analytics/docs');
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.analytics.total_clicks).toBe(4);
    expect(analyticsRes.body.analytics.unique_visitors).toBeGreaterThanOrEqual(1);
    expect(analyticsRes.body.analytics.clicks_by_day.length).toBeGreaterThanOrEqual(1);
    expect(analyticsRes.body.analytics.top_referrers.length).toBeGreaterThanOrEqual(1);
    expect(analyticsRes.body.analytics.browser_breakdown.length).toBeGreaterThanOrEqual(1);

    // Step 4: View global analytics
    const globalRes = await request(app).get('/api/analytics');
    expect(globalRes.status).toBe(200);
    expect(globalRes.body.total_urls).toBe(1);
    expect(globalRes.body.total_clicks).toBe(4);
    expect(globalRes.body.top_urls[0].slug).toBe('docs');
    expect(globalRes.body.top_urls[0].click_count).toBe(4);

    // Step 5: Date-filtered analytics should include today's clicks
    const today = new Date().toISOString().split('T')[0];
    const filteredRes = await request(app).get(`/api/analytics/docs?start=${today}&end=${today}`);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.analytics.total_clicks).toBe(4);
  });
});

describe('Scenario: Analytics across multiple URLs', () => {
  it('should track and compare analytics across different URLs', async () => {
    // Create multiple URLs
    await request(app).post('/api/urls').send({ url: 'https://popular.com', customSlug: 'popular' });
    await request(app).post('/api/urls').send({ url: 'https://niche.com', customSlug: 'niche' });
    await request(app).post('/api/urls').send({ url: 'https://zero.com', customSlug: 'zero-clicks' });

    // Popular URL gets many clicks
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/urls/popular').redirects(0);
    }

    // Niche URL gets one click
    await request(app).get('/api/urls/niche').redirects(0);

    // Zero-clicks URL gets no clicks

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Global analytics should reflect the distribution
    const globalRes = await request(app).get('/api/analytics');
    expect(globalRes.status).toBe(200);
    expect(globalRes.body.total_urls).toBe(3);
    expect(globalRes.body.total_clicks).toBe(6);

    // Top URLs should be ordered by click count
    const topUrls = globalRes.body.top_urls;
    expect(topUrls[0].slug).toBe('popular');
    expect(topUrls[0].click_count).toBe(5);

    // Per-URL analytics for URL with no clicks
    const zeroRes = await request(app).get('/api/analytics/zero-clicks');
    expect(zeroRes.status).toBe(200);
    expect(zeroRes.body.analytics.total_clicks).toBe(0);
    expect(zeroRes.body.analytics.unique_visitors).toBe(0);
  });
});

describe('Scenario: Analytics resilience', () => {
  it('should still redirect even without analytics endpoint', async () => {
    // Create URL
    await request(app).post('/api/urls').send({ url: 'https://example.com', customSlug: 'resilient' });

    // Redirect should work regardless of analytics
    const res = await request(app).get('/api/urls/resilient').redirects(0);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com');

    // Analytics for non-existent URL should 404
    const analyticsRes = await request(app).get('/api/analytics/nonexistent');
    expect(analyticsRes.status).toBe(404);
  });
});
