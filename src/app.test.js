const request = require('supertest');
const redis = require('./cache/redis');
const db = require('./db/pool');
const urlCache = require('./cache/urlCache');

// Mock Redis module methods BEFORE requiring index.js
// index.js now accesses redis.healthCheck() through the module object,
// so replacing it here will take effect at call time.
redis.getClient = vi.fn().mockResolvedValue(null);
redis.healthCheck = vi.fn().mockResolvedValue({ connected: false, latencyMs: null });

// Mock urlCache to prevent Redis connection attempts
urlCache.getUrl = vi.fn().mockResolvedValue(null);
urlCache.setUrl = vi.fn().mockResolvedValue(undefined);
urlCache.invalidate = vi.fn().mockResolvedValue(undefined);

// Replace db.query with a mock
const mockQuery = vi.fn();
db.query = mockQuery;

// Prevent actual DB pool from connecting
vi.spyOn(db.pool, 'query').mockImplementation(() => {
  throw new Error('should not call pool.query directly in app tests');
});

// Suppress connection-related error logs
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('Redis') || msg.includes('connect')) return;
  originalConsoleError.call(console, ...args);
};

const { app } = require('./index');

beforeEach(() => {
  redis.healthCheck.mockClear();
  redis.healthCheck.mockResolvedValue({ connected: false, latencyMs: null });
  redis.getClient.mockClear();
  redis.getClient.mockResolvedValue(null);
  mockQuery.mockReset();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('App-level wiring', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeTruthy();
      expect(res.body.redis).toBeDefined();
      expect(typeof res.body.redis.connected).toBe('boolean');
    });
  });

  describe('Security headers (Helmet)', () => {
    it('should set X-Content-Type-Options header', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-frame-options']).toBeTruthy();
    });

    it('should remove X-Powered-By header', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('JSON body parsing', () => {
    it('should parse valid JSON body', async () => {
      const res = await request(app)
        .post('/api/urls')
        .set('Content-Type', 'application/json')
        .send({ url: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('URL is required');
    });

    it('should return 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/urls')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid JSON in request body');
    });

    it('should reject payloads larger than 10kb', async () => {
      const largeBody = JSON.stringify({ url: 'https://example.com', data: 'x'.repeat(11000) });

      const res = await request(app)
        .post('/api/urls')
        .set('Content-Type', 'application/json')
        .send(largeBody);

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Request body too large');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://example.com');

      expect(res.headers['access-control-allow-origin']).toBeTruthy();
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown API routes', async () => {
      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
