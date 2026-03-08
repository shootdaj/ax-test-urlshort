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

const analyticsRouter = require('./analytics');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
  app.use(errorHandler);
  return app;
}

describe('GET /api/analytics (global summary)', () => {
  it('should return global analytics summary', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // url count
      .mockResolvedValueOnce({ rows: [{ total: '42' }] }) // click count
      .mockResolvedValueOnce({
        rows: [
          { slug: 'abc', original_url: 'https://example.com', click_count: '20' },
          { slug: 'def', original_url: 'https://other.com', click_count: '10' },
        ],
      }); // top urls

    const app = createApp();
    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);
    expect(res.body.total_urls).toBe(5);
    expect(res.body.total_clicks).toBe(42);
    expect(res.body.top_urls).toHaveLength(2);
    expect(res.body.top_urls[0].slug).toBe('abc');
    expect(res.body.top_urls[0].click_count).toBe(20);
  });

  it('should return zeros when no data exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/analytics');

    expect(res.status).toBe(200);
    expect(res.body.total_urls).toBe(0);
    expect(res.body.total_clicks).toBe(0);
    expect(res.body.top_urls).toHaveLength(0);
  });
});

describe('GET /api/analytics/:slug', () => {
  const mockUrl = { id: 1, slug: 'abc123', original_url: 'https://example.com', created_at: '2026-01-01' };

  it('should return full analytics for a URL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockUrl] }) // url lookup
      .mockResolvedValueOnce({ rows: [{ total: '15' }] }) // total clicks
      .mockResolvedValueOnce({ rows: [{ total: '8' }] }) // unique visitors
      .mockResolvedValueOnce({ rows: [{ date: '2026-03-01', clicks: '5' }, { date: '2026-03-02', clicks: '10' }] }) // clicks by day
      .mockResolvedValueOnce({ rows: [{ hour: 9, clicks: '3' }, { hour: 14, clicks: '7' }] }) // clicks by hour
      .mockResolvedValueOnce({ rows: [{ referrer: 'https://google.com', count: '10' }] }) // top referrers
      .mockResolvedValueOnce({ rows: [{ browser: 'Chrome', count: '12' }, { browser: 'Firefox', count: '3' }] }); // browser breakdown

    const app = createApp();
    const res = await request(app).get('/api/analytics/abc123');

    expect(res.status).toBe(200);
    expect(res.body.url.slug).toBe('abc123');
    expect(res.body.analytics.total_clicks).toBe(15);
    expect(res.body.analytics.unique_visitors).toBe(8);
    expect(res.body.analytics.clicks_by_day).toHaveLength(2);
    expect(res.body.analytics.clicks_by_hour).toHaveLength(2);
    expect(res.body.analytics.clicks_by_hour[0]).toEqual({ hour: 9, clicks: 3 });
    expect(res.body.analytics.top_referrers).toHaveLength(1);
    expect(res.body.analytics.top_referrers[0]).toEqual({ referrer: 'https://google.com', count: 10 });
    expect(res.body.analytics.browser_breakdown).toHaveLength(2);
    expect(res.body.analytics.browser_breakdown[0]).toEqual({ browser: 'Chrome', count: 12 });
  });

  it('should return 404 for unknown slug', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/analytics/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('URL not found');
  });

  it('should return 400 for slug with special characters', async () => {
    const app = createApp();
    const res = await request(app).get('/api/analytics/slug<script>');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid slug parameter');
  });

  it('should return 400 for slug that is too long', async () => {
    const app = createApp();
    const res = await request(app).get('/api/analytics/' + 'a'.repeat(33));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Slug parameter is too long');
  });

  it('should accept valid date range parameters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockUrl] })
      .mockResolvedValueOnce({ rows: [{ total: '5' }] })
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/analytics/abc123?start=2026-03-01&end=2026-03-08');

    expect(res.status).toBe(200);
    expect(res.body.analytics.total_clicks).toBe(5);

    // Verify the date params were passed in the query
    const totalClicksCall = mockQuery.mock.calls[1];
    expect(totalClicksCall[1]).toContain('2026-03-01T00:00:00Z');
    expect(totalClicksCall[1]).toContain('2026-03-08T00:00:00Z');
  });

  it('should return 400 for invalid start date format', async () => {
    const app = createApp();
    const res = await request(app).get('/api/analytics/abc123?start=not-a-date');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid start date');
  });

  it('should return 400 for invalid end date format', async () => {
    const app = createApp();
    const res = await request(app).get('/api/analytics/abc123?end=2026/03/01');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid end date');
  });

  it('should work with only start date', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockUrl] })
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/analytics/abc123?start=2026-03-01');

    expect(res.status).toBe(200);
    // Should have start param but no end param
    const totalClicksCall = mockQuery.mock.calls[1];
    expect(totalClicksCall[1]).toHaveLength(2); // urlId + start
    expect(totalClicksCall[1][1]).toBe('2026-03-01T00:00:00Z');
  });

  it('should work with only end date', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [mockUrl] })
      .mockResolvedValueOnce({ rows: [{ total: '7' }] })
      .mockResolvedValueOnce({ rows: [{ total: '4' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const app = createApp();
    const res = await request(app).get('/api/analytics/abc123?end=2026-03-08');

    expect(res.status).toBe(200);
    const totalClicksCall = mockQuery.mock.calls[1];
    expect(totalClicksCall[1]).toHaveLength(2); // urlId + end
  });
});

describe('buildDateFilter', () => {
  const { _buildDateFilter: buildDateFilter } = require('./analytics');

  it('should return base filter without date params', () => {
    const result = buildDateFilter(1, undefined, undefined);
    expect(result.clause).toBe('url_id = $1');
    expect(result.params).toEqual([1]);
  });

  it('should add start date filter', () => {
    const result = buildDateFilter(1, '2026-03-01', undefined);
    expect(result.clause).toBe('url_id = $1 AND clicked_at >= $2::timestamp');
    expect(result.params).toEqual([1, '2026-03-01T00:00:00Z']);
  });

  it('should add end date filter', () => {
    const result = buildDateFilter(1, undefined, '2026-03-08');
    expect(result.clause).toContain("clicked_at < ($2::timestamp + interval '1 day')");
    expect(result.params).toEqual([1, '2026-03-08T00:00:00Z']);
  });

  it('should add both start and end date filters', () => {
    const result = buildDateFilter(1, '2026-03-01', '2026-03-08');
    expect(result.clause).toContain('clicked_at >= $2::timestamp');
    expect(result.clause).toContain("clicked_at < ($3::timestamp + interval '1 day')");
    expect(result.params).toEqual([1, '2026-03-01T00:00:00Z', '2026-03-08T00:00:00Z']);
  });
});
