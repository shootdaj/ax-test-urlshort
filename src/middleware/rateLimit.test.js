const redis = require('../cache/redis');
const { rateLimit, RATE_LIMIT_PREFIX, DEFAULT_WINDOW_SECONDS, DEFAULT_MAX_REQUESTS } = require('./rateLimit');

// Save original
const originalGetClient = redis.getClient;

const mockRedisClient = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  redis.getClient = vi.fn().mockResolvedValue(mockRedisClient);
});

afterAll(() => {
  redis.getClient = originalGetClient;
});

function createMockReq(ip = '127.0.0.1') {
  return { ip, headers: {} };
}

function createMockRes() {
  const res = {
    _headers: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn((key, value) => {
      res._headers[key] = value;
    }),
  };
  return res;
}

describe('rateLimit middleware', () => {
  it('should allow requests under the limit', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);
    mockRedisClient.expire.mockResolvedValueOnce(true);
    mockRedisClient.ttl.mockResolvedValueOnce(60);

    const middleware = rateLimit({ windowSeconds: 60, maxRequests: 10 });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res._headers['X-RateLimit-Limit']).toBe('10');
    expect(res._headers['X-RateLimit-Remaining']).toBe('9');
    expect(res._headers['X-RateLimit-Reset']).toBe('60');
  });

  it('should set expire only on first request in window', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);
    mockRedisClient.expire.mockResolvedValueOnce(true);
    mockRedisClient.ttl.mockResolvedValueOnce(60);

    const middleware = rateLimit();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockRedisClient.expire).toHaveBeenCalledWith(
      expect.stringContaining(RATE_LIMIT_PREFIX),
      DEFAULT_WINDOW_SECONDS
    );
  });

  it('should NOT set expire on subsequent requests', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(5);
    mockRedisClient.ttl.mockResolvedValueOnce(42);

    const middleware = rateLimit();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockRedisClient.expire).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should return 429 when limit is exceeded', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(11);
    mockRedisClient.ttl.mockResolvedValueOnce(30);

    const middleware = rateLimit({ windowSeconds: 60, maxRequests: 10 });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many requests',
      retryAfter: 30,
    });
    expect(res._headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('should allow requests when Redis is unavailable (fail open)', async () => {
    redis.getClient = vi.fn().mockResolvedValue(null);

    const middleware = rateLimit();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow requests on Redis error (fail open)', async () => {
    mockRedisClient.incr.mockRejectedValueOnce(new Error('Redis error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const middleware = rateLimit();
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Rate limit error:', 'Redis error');
    console.error.mockRestore();
  });

  it('should use custom window and max values', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);
    mockRedisClient.expire.mockResolvedValueOnce(true);
    mockRedisClient.ttl.mockResolvedValueOnce(120);

    const middleware = rateLimit({ windowSeconds: 120, maxRequests: 5 });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockRedisClient.expire).toHaveBeenCalledWith(expect.any(String), 120);
    expect(res._headers['X-RateLimit-Limit']).toBe('5');
    expect(res._headers['X-RateLimit-Remaining']).toBe('4');
  });

  it('should use IP address as rate limit key', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(1);
    mockRedisClient.expire.mockResolvedValueOnce(true);
    mockRedisClient.ttl.mockResolvedValueOnce(60);

    const middleware = rateLimit();
    const req = createMockReq('192.168.1.100');
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockRedisClient.incr).toHaveBeenCalledWith(RATE_LIMIT_PREFIX + '192.168.1.100');
  });

  it('should show remaining as 0 when at exact limit', async () => {
    mockRedisClient.incr.mockResolvedValueOnce(10);
    mockRedisClient.ttl.mockResolvedValueOnce(15);

    const middleware = rateLimit({ maxRequests: 10 });
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._headers['X-RateLimit-Remaining']).toBe('0');
  });
});

describe('constants', () => {
  it('should export correct defaults', () => {
    expect(RATE_LIMIT_PREFIX).toBe('ratelimit:');
    expect(DEFAULT_WINDOW_SECONDS).toBe(60);
    expect(DEFAULT_MAX_REQUESTS).toBe(10);
  });
});
