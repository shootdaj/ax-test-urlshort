const redis = require('./redis');
const urlCache = require('./urlCache');

// Save original
const originalGetClient = redis.getClient;

const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Replace getClient on the module object so urlCache.js picks it up
  redis.getClient = vi.fn().mockResolvedValue(mockRedisClient);
});

afterAll(() => {
  redis.getClient = originalGetClient;
});

describe('getUrl', () => {
  it('should return cached URL record on cache hit', async () => {
    const urlRecord = { id: 1, slug: 'abc123', original_url: 'https://example.com' };
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(urlRecord));

    const result = await urlCache.getUrl('abc123');

    expect(result).toEqual(urlRecord);
    expect(mockRedisClient.get).toHaveBeenCalledWith(urlCache.CACHE_PREFIX + 'abc123');
  });

  it('should return null on cache miss', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);

    const result = await urlCache.getUrl('nonexistent');

    expect(result).toBeNull();
  });

  it('should return null when Redis is unavailable', async () => {
    redis.getClient = vi.fn().mockResolvedValue(null);

    const result = await urlCache.getUrl('abc123');

    expect(result).toBeNull();
    expect(mockRedisClient.get).not.toHaveBeenCalled();
  });

  it('should return null and log error on Redis get failure', async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await urlCache.getUrl('abc123');

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith('Cache get error:', 'Redis error');
    console.error.mockRestore();
  });
});

describe('setUrl', () => {
  it('should store URL record with default TTL', async () => {
    const urlRecord = { id: 1, slug: 'abc123', original_url: 'https://example.com' };
    mockRedisClient.set.mockResolvedValueOnce('OK');

    await urlCache.setUrl('abc123', urlRecord);

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      urlCache.CACHE_PREFIX + 'abc123',
      JSON.stringify(urlRecord),
      { EX: urlCache.DEFAULT_TTL }
    );
  });

  it('should store URL record with custom TTL', async () => {
    const urlRecord = { id: 1, slug: 'abc123', original_url: 'https://example.com' };
    mockRedisClient.set.mockResolvedValueOnce('OK');

    await urlCache.setUrl('abc123', urlRecord, 300);

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      urlCache.CACHE_PREFIX + 'abc123',
      JSON.stringify(urlRecord),
      { EX: 300 }
    );
  });

  it('should silently skip when Redis is unavailable', async () => {
    redis.getClient = vi.fn().mockResolvedValue(null);

    await urlCache.setUrl('abc123', { id: 1 });

    expect(mockRedisClient.set).not.toHaveBeenCalled();
  });

  it('should log error on Redis set failure', async () => {
    mockRedisClient.set.mockRejectedValueOnce(new Error('Redis write error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await urlCache.setUrl('abc123', { id: 1 });

    expect(console.error).toHaveBeenCalledWith('Cache set error:', 'Redis write error');
    console.error.mockRestore();
  });
});

describe('invalidate', () => {
  it('should delete cached URL record', async () => {
    mockRedisClient.del.mockResolvedValueOnce(1);

    await urlCache.invalidate('abc123');

    expect(mockRedisClient.del).toHaveBeenCalledWith(urlCache.CACHE_PREFIX + 'abc123');
  });

  it('should silently skip when Redis is unavailable', async () => {
    redis.getClient = vi.fn().mockResolvedValue(null);

    await urlCache.invalidate('abc123');

    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it('should log error on Redis del failure', async () => {
    mockRedisClient.del.mockRejectedValueOnce(new Error('Redis delete error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await urlCache.invalidate('abc123');

    expect(console.error).toHaveBeenCalledWith('Cache invalidate error:', 'Redis delete error');
    console.error.mockRestore();
  });
});

describe('constants', () => {
  it('should export correct cache prefix', () => {
    expect(urlCache.CACHE_PREFIX).toBe('url:');
  });

  it('should export default TTL of 1 hour', () => {
    expect(urlCache.DEFAULT_TTL).toBe(3600);
  });
});
