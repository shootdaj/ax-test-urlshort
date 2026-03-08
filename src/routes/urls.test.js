const { describe, it, expect, vi, beforeEach } = require('vitest');
const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../middleware/errors');

// Mock the db/pool module
vi.mock('../db/pool', () => ({
  query: vi.fn(),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'abc12345'),
}));

const { query } = require('../db/pool');
const urlRouter = require('./urls');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/urls', urlRouter);
  app.use(errorHandler);
  return app;
}

describe('POST /api/urls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a URL with generated slug', async () => {
    const mockRow = { id: 1, slug: 'abc12345', original_url: 'https://example.com', created_at: new Date().toISOString() };
    query.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('abc12345');
    expect(res.body.original_url).toBe('https://example.com');
  });

  it('should create a URL with custom slug', async () => {
    const mockRow = { id: 1, slug: 'my-custom', original_url: 'https://example.com', created_at: new Date().toISOString() };
    query.mockResolvedValueOnce({ rows: [mockRow] });

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
    query.mockRejectedValueOnce(err);

    const app = createApp();
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'https://example.com', customSlug: 'existing' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Slug already exists');
  });
});

describe('GET /api/urls/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to original URL', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    query.mockResolvedValueOnce({ rows: [mockRow] }); // SELECT
    query.mockResolvedValueOnce({ rows: [] }); // INSERT click

    const app = createApp();
    const res = await request(app)
      .get('/api/urls/abc123')
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('should return 404 for unknown slug', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/urls/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });
});

describe('GET /api/urls/:slug/info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return URL info without redirecting', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: new Date().toISOString() };
    query.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app).get('/api/urls/abc123/info');

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('abc123');
    expect(res.body.original_url).toBe('https://example.com');
  });

  it('should return 404 for unknown slug info', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/urls/nonexistent/info');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });
});

describe('GET /api/urls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list URLs', async () => {
    const mockRows = [
      { id: 1, slug: 'abc', original_url: 'https://example.com', click_count: '3', created_at: new Date().toISOString() },
      { id: 2, slug: 'def', original_url: 'https://other.com', click_count: '0', created_at: new Date().toISOString() },
    ];
    query.mockResolvedValueOnce({ rows: mockRows });

    const app = createApp();
    const res = await request(app).get('/api/urls');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].slug).toBe('abc');
  });
});

describe('DELETE /api/urls/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a URL', async () => {
    const mockRow = { id: 1, slug: 'abc123', original_url: 'https://example.com' };
    query.mockResolvedValueOnce({ rows: [mockRow] });

    const app = createApp();
    const res = await request(app).delete('/api/urls/abc123');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('should return 404 when deleting unknown slug', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).delete('/api/urls/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });
});
