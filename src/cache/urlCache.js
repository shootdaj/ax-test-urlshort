const redis = require('./redis');

const CACHE_PREFIX = 'url:';
const DEFAULT_TTL = 3600; // 1 hour in seconds

/**
 * Get a URL record from cache by slug.
 * Returns the cached object or null (cache miss / Redis unavailable).
 */
async function getUrl(slug) {
  try {
    const client = await redis.getClient();
    if (!client) return null;

    const data = await client.get(CACHE_PREFIX + slug);
    if (!data) return null;

    return JSON.parse(data);
  } catch (err) {
    console.error('Cache get error:', err.message);
    return null;
  }
}

/**
 * Store a URL record in cache (cache-aside: caller fetches from DB, then caches).
 */
async function setUrl(slug, urlRecord, ttl = DEFAULT_TTL) {
  try {
    const client = await redis.getClient();
    if (!client) return;

    await client.set(CACHE_PREFIX + slug, JSON.stringify(urlRecord), { EX: ttl });
  } catch (err) {
    console.error('Cache set error:', err.message);
  }
}

/**
 * Invalidate (remove) a URL record from cache.
 * Called on URL deletion.
 */
async function invalidate(slug) {
  try {
    const client = await redis.getClient();
    if (!client) return;

    await client.del(CACHE_PREFIX + slug);
  } catch (err) {
    console.error('Cache invalidate error:', err.message);
  }
}

module.exports = { getUrl, setUrl, invalidate, CACHE_PREFIX, DEFAULT_TTL };
