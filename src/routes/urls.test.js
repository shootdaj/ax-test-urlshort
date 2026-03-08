const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../middleware/errors');
const db = require('../db/pool');

// Replace db.query with a mock function
const originalQuery = db.query;
const mockQuery = vi.fn();

beforeEach(() => {
  db.query = mockQuery;
  mockQuery.mockReset();
});

afterAll(() => {
  db.query = originalQuery;
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
  it('should redirect to original URL', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] }); // SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT click (non-blocking)

    const app = createApp();
    const res = await request(app)
      .get('/api/urls/abc123')
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('should record click with parsed user-agent metadata', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
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
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/urls/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
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
  it('should delete a URL', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com' };
    mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app).delete('/api/urls/abc123');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('should return 404 when deleting unknown slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).delete('/api/urls/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });
});
