const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../middleware/errors');
const db = require('../db/pool');
const urlCache = require('../cache/urlCache');

// Replace db.query with a mock function
const originalQuery = db.query;
const mockQuery = vi.fn();

// Replace urlCache methods with mocks
const originalGetUrl = urlCache.getUrl;
const originalSetUrl = urlCache.setUrl;
const originalInvalidate = urlCache.invalidate;

beforeEach(() => {
  db.query = mockQuery;
  mockQuery.mockReset();

  // Default cache behavior: miss on get, resolve on set/invalidate
  urlCache.getUrl = vi.fn().mockResolvedValue(null);
  urlCache.setUrl = vi.fn().mockResolvedValue(undefined);
  urlCache.invalidate = vi.fn().mockResolvedValue(undefined);
});

afterAll(() => {
  db.query = originalQuery;
  urlCache.getUrl = originalGetUrl;
  urlCache.setUrl = originalSetUrl;
  urlCache.invalidate = originalInvalidate;
});

// Prevent actual pg pool from connecting
vi.spyOn(db.pool, 'query').mockImplementation(() => {
  throw new Error('should not call pool.query directly in unit tests');
});

const urlRouter = require('./urls');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/urls', urlRouter);
  app.use(errorHandler);
  return app;
}

describe('POST /api/urls', () => {
  it('should create a URL with generated slug', async () => {
    const mockRow = { id: 1, slug: 'abc12345', original_url: 'https://example.com', created_at: new Date().toISOString() };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBeTruthy();
    expect(res.body.original_url).toBe('https://example.com');
  });

  it('should cache the newly created URL', async () => {
    const mockRow = { id: 1, slug: 'cached-slug', original_url: 'https://example.com', created_at: new Date().toISOString() };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'cached-slug' });

    expect(urlCache.setUrl).toHaveBeenCalledWith('cached-slug', mockRow);
  });

  it('should create a URL with custom slug', async () => {
    const mockRow = { id: 1, slug: 'my-custom', original_url: 'https://example.com', created_at: new Date().toISOString() };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'my-custom' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('my-custom');
  });

  it('should return 400 when URL is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('URL is required');
  });

  it('should return 400 for invalid URL format', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid URL format');
  });

  it('should return 400 for non-http URL', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'ftp://example.com/file' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('URL must use http or https protocol');
  });

  it('should return 400 for invalid custom slug', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Slug must be between 3 and 32 characters');
  });

  it('should return 400 for slug with invalid characters', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'has spaces!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Slug may only contain letters, numbers, and hyphens');
  });

  it('should return 400 for URL exceeding max length', async () => {
    const app = createApp();
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    const res = await request(app)
      .post('/api/urls')
      .send({ url: longUrl });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must not exceed');
  });

  it('should return 400 for URL with credentials', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://admin:password@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('URL must not contain credentials');
  });

  it('should return 400 for javascript: protocol URL', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for data: protocol URL', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'data:text/html,<script>alert(1)</script>' });

    expect(res.status).toBe(400);
  });

  it('should return 409 for duplicate slug', async () => {
    const err = new Error('duplicate key');
    err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);

    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'existing' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Slug already exists');
  });
});

describe('GET /api/urls/:slug', () => {
  it('should redirect to original URL (cache miss, DB hit)', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(null); // cache miss
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] }); // DB hit
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click (non-blocking)

    const app = createApp();
    const res = await request(app)
      .get('/api/urls/abc123')
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('should redirect using cached URL (cache hit, no DB query)', async () => {
    const cachedRecord = { id: 1, slug: 'cached', original_url: 'https://cached.com', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(cachedRecord); // cache hit
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click (non-blocking)

    const app = createApp();
    const res = await request(app)
      .get('/api/urls/cached')
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://cached.com');
    // DB query for SELECT should NOT have been called (only click INSERT)
    const selectCalls = mockQuery.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('SELECT') && call[0].includes('urls')
    );
    expect(selectCalls).toHaveLength(0);
  });

  it('should populate cache after DB hit', async () => {
    const mockRow = { id: 1, slug: 'populate', original_url: 'https://example.com', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(null); // cache miss
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] }); // DB hit
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click

    const app = createApp();
    await request(app)
      .get('/api/urls/populate')
      .redirects(0);

    // Wait for non-blocking cache set
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(urlCache.setUrl).toHaveBeenCalledWith('populate', mockRow);
  });

  it('should record click with parsed user-agent metadata', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(null);
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] }); // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click

    const app = createApp();
    await request(app)
      .get('/api/urls/abc123')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      .redirects(0);

    // Wait for non-blocking click recording to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify the click INSERT was called with browser/os params
    const clickInsertCall = mockQuery.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO clicks')
    );
    expect(clickInsertCall).toBeTruthy();
    // Params: [url_id, referrer, user_agent, ip, browser, os]
    expect(clickInsertCall[1][4]).toBe('Chrome'); // browser
    expect(clickInsertCall[1][5]).toBe('Windows'); // os
  });

  it('should still redirect even if click recording fails', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(null);
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] }); // SELECT
    mockQuery.mockRejectedValueOnce(new Error('DB write failed')); // INSERT click fails

    // Suppress the console.error from the catch handler
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createApp();
    const res = await request(app)
      .get('/api/urls/abc123')
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com');

    console.error.mockRestore();
  });

  it('should return 404 for unknown slug', async () => {
    urlCache.getUrl = vi.fn().mockResolvedValue(null);
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/urls/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });

  it('should return 400 for slug with special characters', async () => {
    const app = createApp();
    const res = await request(app).get('/api/urls/slug<script>');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid slug parameter');
  });

  it('should return 400 for slug that is too long', async () => {
    const app = createApp();
    const res = await request(app).get('/api/urls/' + 'a'.repeat(33));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Slug parameter is too long');
  });

  it('should return 502 if stored URL has invalid scheme', async () => {
    const badRecord = { id: 1, slug: 'bad-url', original_url: 'ftp://evil.com/file', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(badRecord);
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click

    vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createApp();
    const res = await request(app)
      .get('/api/urls/bad-url')
      .redirects(0);

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('Stored URL is invalid');

    console.error.mockRestore();
  });

  it('should truncate long user-agent before recording', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    urlCache.getUrl = vi.fn().mockResolvedValue(null);
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] }); // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click

    const app = createApp();
    const longUA = 'Mozilla/' + 'x'.repeat(1000);
    await request(app)
      .get('/api/urls/abc123')
      .set('User-Agent', longUA)
      .redirects(0);

    // Wait for non-blocking click recording
    await new Promise((resolve) => setTimeout(resolve, 50));

    const clickInsertCall = mockQuery.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO clicks')
    );
    expect(clickInsertCall).toBeTruthy();
    // user_agent is param index 2 (0-indexed)
    expect(clickInsertCall[1][2].length).toBeLessThanOrEqual(512);
  });
});

describe('GET /api/urls/:slug/info', () => {
  it('should return URL info without redirecting', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app).get('/api/urls/abc123/info');

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('abc123');
    expect(res.body.original_url).toBe('https://example.com');
  });

  it('should return 404 for unknown slug info', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/urls/nonexistent/info');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });

  it('should return 400 for slug with special characters in info', async () => {
    const app = createApp();
    const res = await request(app).get('/api/urls/slug<script>/info');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid slug parameter');
  });
});

describe('GET /api/urls', () => {
  it('should list URLs', async () => {
    const mockRows = [
      { id: 1, slug: 'abc', original_url: 'https://example.com', click_count: '3', created_at: new Date().toISOString() },
      { id: 2, slug: 'def', original_url: 'https://other.com', click_count: '0', created_at: new Date().toISOString() },
    ];
    mockQuery.mockResolvedValueOnce({ rows: mockRows });

    const app = createApp();
    const res = await request(app).get('/api/urls');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].slug).toBe('abc');
  });
});

describe('DELETE /api/urls/:slug', () => {
  it('should delete a URL and invalidate cache', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com' };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app).delete('/api/urls/abc123');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    // Wait for non-blocking cache invalidation
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(urlCache.invalidate).toHaveBeenCalledWith('abc123');
  });

  it('should return 404 when deleting unknown slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).delete('/api/urls/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });

  it('should not invalidate cache when URL not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    await request(app).delete('/api/urls/nonexistent');

    // Wait a bit to ensure invalidate wasn't called
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(urlCache.invalidate).not.toHaveBeenCalled();
  });

  it('should return 400 for slug with special characters on delete', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/urls/slug<script>');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid slug parameter');
  });
});
