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

  // Run migrations
  const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await testPool.query(sql);

  // Connect Redis
  redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();

  // Override the db module
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

describe('Redis Cache Integration', () => {
  it('should cache URL on creation and serve from cache on redirect', async () => {
    // Create URL
    const createRes = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'cache-test' });
    expect(createRes.status).toBe(201);

    // Verify it's cached in Redis
    const cached = await redisClient.get('url:cache-test');
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached);
    expect(parsed.slug).toBe('cache-test');
    expect(parsed.original_url).toBe('https://example.com');

    // Redirect should work (served from cache)
    const redirectRes = await request(app)
      .get('/api/urls/cache-test')
      .redirects(0);
    expect(redirectRes.status).toBe(301);
    expect(redirectRes.headers.location).toBe('https://example.com');
  });

  it('should invalidate cache on URL deletion', async () => {
    // Create URL
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'del-cache' });

    // Verify cached
    let cached = await redisClient.get('url:del-cache');
    expect(cached).toBeTruthy();

    // Delete URL
    const deleteRes = await request(app).delete('/api/urls/del-cache');
    expect(deleteRes.status).toBe(200);

    // Wait for non-blocking invalidation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify cache is cleared
    cached = await redisClient.get('url:del-cache');
    expect(cached).toBeNull();
  });

  it('should populate cache on redirect when cache miss', async () => {
    // Insert URL directly into DB (bypassing create endpoint to avoid caching)
    await testPool.query(
      "INSERT INTO urls (slug, original_url) VALUES ('direct-insert', 'https://direct.com')"
    );

    // Clear any cache
    await redisClient.del('url:direct-insert');

    // Redirect should trigger cache population
    const redirectRes = await request(app)
      .get('/api/urls/direct-insert')
      .redirects(0);
    expect(redirectRes.status).toBe(301);

    // Wait for non-blocking cache set
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify cache was populated
    const cached = await redisClient.get('url:direct-insert');
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached);
    expect(parsed.original_url).toBe('https://direct.com');
  });

  it('should set cache with TTL', async () => {
    // Create URL
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'ttl-test' });

    // Check TTL is set
    const ttl = await redisClient.ttl('url:ttl-test');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600); // DEFAULT_TTL
  });
});

describe('Rate Limiting Integration', () => {
  it('should return rate limit headers on POST /api/urls', async () => {
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com' });

    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should enforce rate limit after too many requests', async () => {
    // Send 11 requests (limit is 10)
    const results = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: `https://example${i}.com` });
      results.push(res);
    }

    // First 10 should succeed (201 for valid URLs)
    for (let i = 0; i < 10; i++) {
      expect(results[i].status).toBe(201);
    }

    // 11th should be rate limited
    expect(results[10].status).toBe(429);
    expect(results[10].body.error).toBe('Too many requests');
    expect(results[10].body.retryAfter).toBeGreaterThan(0);
  });

  it('should not rate limit GET requests', async () => {
    // Create a URL first
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'no-limit' });

    // GET requests should not be rate limited
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .get('/api/urls/no-limit')
        .redirects(0);
      expect(res.status).toBe(301);
    }
  });
});

describe('Redis Health Check Integration', () => {
  it('should report Redis status in health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.redis).toBeDefined();
    expect(res.body.redis.connected).toBe(true);
    expect(res.body.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
