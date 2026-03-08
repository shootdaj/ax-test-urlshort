/**
 * Security Hardening Scenario Tests
 *
 * These tests verify that all security hardening measures work together
 * as a complete security layer. They require PostgreSQL and Redis.
 */
const request = require('supertest');
const db = require('../../src/db/pool');
const redis = require('../../src/cache/redis');

let app;

beforeAll(async () => {
  // Test if DB is available
  try {
    await db.query('SELECT 1');
  } catch {
    console.log('PostgreSQL not available — skipping security scenario tests');
    return;
  }

  // Run migrations
  const fs = require('fs');
  const schema = fs.readFileSync(require('path').join(__dirname, '../../src/db/schema.sql'), 'utf-8');
  await db.query(schema);

  ({ app } = require('../../src/index'));
});

afterAll(async () => {
  try {
    await db.query('DROP TABLE IF EXISTS clicks CASCADE');
    await db.query('DROP TABLE IF EXISTS urls CASCADE');
  } catch {}
  try {
    await redis.disconnect();
  } catch {}
  await db.pool.end();
});

const itIfDb = (() => {
  let dbAvailable = null;
  return (name, fn) => {
    it(name, async () => {
      if (dbAvailable === null) {
        try {
          await db.query('SELECT 1');
          dbAvailable = true;
        } catch {
          dbAvailable = false;
        }
      }
      if (!dbAvailable) {
        return; // skip
      }
      await fn();
    });
  };
})();

describe('Security Hardening Scenarios', () => {
  describe('Input validation prevents malicious URLs', () => {
    itIfDb('should reject javascript: protocol URLs', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'javascript:alert(document.cookie)' });

      expect(res.status).toBe(400);
    });

    itIfDb('should reject data: protocol URLs', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });

      expect(res.status).toBe(400);
    });

    itIfDb('should reject URLs with embedded credentials', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://admin:password@phishing-site.com/login' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('URL must not contain credentials');
    });

    itIfDb('should reject oversized URLs', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://example.com/' + 'a'.repeat(2048) });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must not exceed');
    });
  });

  describe('Slug parameter sanitization prevents injection', () => {
    itIfDb('should reject XSS in slug parameter on redirect', async () => {
      const res = await request(app)
        .get('/api/urls/<script>alert(1)</script>');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid slug parameter');
    });

    itIfDb('should reject path traversal in slug parameter', async () => {
      const res = await request(app)
        .get('/api/urls/../../../etc/passwd');

      // Express may handle this differently, but the slug should be rejected
      expect([400, 404]).toContain(res.status);
    });

    itIfDb('should reject SQL injection attempt in slug', async () => {
      const res = await request(app)
        .get("/api/urls/'; DROP TABLE urls;--");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid slug parameter');
    });

    itIfDb('should reject slug with null bytes', async () => {
      const res = await request(app)
        .get('/api/urls/test%00injection');

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('Request size limits prevent abuse', () => {
    itIfDb('should reject oversized request bodies', async () => {
      const largeBody = JSON.stringify({
        url: 'https://example.com',
        data: 'x'.repeat(11000),
      });

      const res = await request(app)
        .post('/api/urls')
        .set('Content-Type', 'application/json')
        .send(largeBody);

      expect(res.status).toBe(413);
    });

    itIfDb('should reject malformed JSON gracefully', async () => {
      const res = await request(app)
        .post('/api/urls')
        .set('Content-Type', 'application/json')
        .send('{"url": "https://example.com"');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid JSON in request body');
    });
  });

  describe('Security headers are present', () => {
    itIfDb('should include security headers from Helmet', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
