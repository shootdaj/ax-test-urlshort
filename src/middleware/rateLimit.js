const redis = require('../cache/redis');

const RATE_LIMIT_PREFIX = 'ratelimit:';
const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_REQUESTS = 10;

/**
 * Create a rate-limiting middleware using Redis sliding window counter.
 * Falls back to allowing all requests if Redis is unavailable.
 *
 * @param {object} options
 * @param {number} options.windowSeconds - Time window in seconds (default 60)
 * @param {number} options.maxRequests - Max requests per window (default 10)
 */
function rateLimit(options = {}) {
  const windowSeconds = options.windowSeconds || DEFAULT_WINDOW_SECONDS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const client = await redis.getClient();
      if (!client) {
        // Redis unavailable — allow request (graceful degradation)
        return next();
      }

      const identifier = req.ip || 'unknown';
      const key = RATE_LIMIT_PREFIX + identifier;

      // Increment the counter and set TTL on first request
      const current = await client.incr(key);

      if (current === 1) {
        // First request in this window — set expiry
        await client.expire(key, windowSeconds);
      }

      // Get remaining TTL for the response header
      const ttl = await client.ttl(key);

      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current)));
      res.set('X-RateLimit-Reset', String(ttl));

      if (current > maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: ttl,
        });
      }

      next();
    } catch (err) {
      console.error('Rate limit error:', err.message);
      // On error, allow request (fail open)
      next();
    }
  };
}

module.exports = { rateLimit, RATE_LIMIT_PREFIX, DEFAULT_WINDOW_SECONDS, DEFAULT_MAX_REQUESTS };
