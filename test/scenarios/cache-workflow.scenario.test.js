const request = require('supertest');
const { Pool } = require('pg');
const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let testPool;
let redisClient;
let app;

beforeAll(async () => {
  testPool = new Pool({ connectionString: DATABASE_URL });

  const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await testPool.query(sql);

  redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();

  const db = require('../../src/db/pool');
  db.query = (text, params) => testPool.query(text, params);
  db.pool = testPool;

  const appModule = require('../../src/index');
  app = appModule.app;
});

afterAll(async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.flushDb();
    await redisClient.quit();
  }
  if (testPool) {
    await testPool.query('DROP TABLE IF EXISTS clicks CASCADE');
    await testPool.query('DROP TABLE IF EXISTS urls CASCADE');
    await testPool.end();
  }
});

beforeEach(async () => {
  await testPool.query('DELETE FROM clicks');
  await testPool.query('DELETE FROM urls');
  if (redisClient && redisClient.isOpen) {
    await redisClient.flushDb();
  }
});

describe('Scenario: Cached redirect workflow', () => {
  it('should create URL, redirect from cache, delete with invalidation, then 404', async () => {
    // Step 1: Create URL — gets cached
    const createRes = await request(app)
      .post('/api/urls')
      .send({ url: 'https://docs.example.com', customSlug: 'docs-cached' });
    expect(createRes.status).toBe(201);

    // Step 2: Verify it's in Redis cache
    const cached = await redisClient.get('url:docs-cached');
    expect(cached).toBeTruthy();

    // Step 3: Redirect (should be served from cache — fast path)
    const redirectRes = await request(app)
      .get('/api/urls/docs-cached')
      .redirects(0);
    expect(redirectRes.status).toBe(301);
    expect(redirectRes.headers.location).toBe('https://docs.example.com');

    // Step 4: Delete URL — should invalidate cache
    const deleteRes = await request(app).delete('/api/urls/docs-cached');
    expect(deleteRes.status).toBe(200);

    // Wait for async cache invalidation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 5: Verify cache is gone
    const afterDelete = await redisClient.get('url:docs-cached');
    expect(afterDelete).toBeNull();

    // Step 6: Redirect should now 404
    const notFoundRes = await request(app)
      .get('/api/urls/docs-cached')
      .redirects(0);
    expect(notFoundRes.status).toBe(404);
  });
});

describe('Scenario: Rate limiting protects the system', () => {
  it('should allow normal usage but block abuse of URL creation', async () => {
    // Step 1: Normal usage — create a few URLs
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: `https://normal${i}.com` });
      expect(res.status).toBe(201);
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    }

    // Step 2: Exhaust the rate limit
    for (let i = 3; i < 10; i++) {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: `https://spam${i}.com` });
      expect(res.status).toBe(201);
    }

    // Step 3: Next request should be blocked
    const blockedRes = await request(app)
      .post('/api/urls')
      .send({ url: 'https://one-too-many.com' });
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toBe('Too many requests');
    expect(blockedRes.body.retryAfter).toBeGreaterThan(0);

    // Step 4: GET requests should still work fine (not rate limited)
    const listRes = await request(app).get('/api/urls');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(10); // 10 URLs were created
  });
});

describe('Scenario: Health check shows Redis status', () => {
  it('should report connected Redis in health endpoint', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.redis.connected).toBe(true);
    expect(healthRes.body.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
