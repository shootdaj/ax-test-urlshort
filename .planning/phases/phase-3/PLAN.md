# Phase 3 Plan: Redis Caching and Rate Limiting

## Tasks

### 1. Create Redis client wrapper (`src/cache/redis.js`)
- Singleton Redis client with lazy connection
- Health check function (ping + latency)
- Graceful error handling — returns null when unavailable
- Disconnect for cleanup/testing

### 2. Create URL cache module (`src/cache/urlCache.js`)
- `getUrl(slug)` — cache-aside read (returns parsed object or null)
- `setUrl(slug, record, ttl)` — cache write with configurable TTL
- `invalidate(slug)` — delete from cache on URL deletion
- All operations degrade gracefully when Redis unavailable

### 3. Create rate limiting middleware (`src/middleware/rateLimit.js`)
- Fixed window counter using Redis INCR + EXPIRE
- Configurable window (seconds) and max requests
- Returns 429 with retryAfter when exceeded
- Sets X-RateLimit-* response headers
- Fails open when Redis unavailable

### 4. Integrate cache into URL routes (`src/routes/urls.js`)
- Redirect: cache-aside lookup before DB query
- Create: populate cache after INSERT
- Delete: invalidate cache after DELETE

### 5. Update app entry point (`src/index.js`)
- Add Redis health info to /health endpoint
- Apply rate limiter to POST /api/urls

### 6. Write unit tests for Redis module
- Module export shape tests (no real connection)

### 7. Write unit tests for URL cache
- Cache hit/miss behavior
- Redis unavailable graceful degradation
- Error logging
- TTL configuration

### 8. Write unit tests for rate limiter
- Under limit / at limit / over limit
- Expire on first request only
- Fail open on Redis unavailable
- Custom configuration
- IP-based key generation

### 9. Write unit tests for updated URL routes
- Cache hit skips DB query
- Cache miss queries DB and populates cache
- Delete invalidates cache
- Existing tests still pass

### 10. Write integration tests for cache and rate limiting
- Cache populated on create, served on redirect, invalidated on delete
- Rate limit headers on POST
- Rate limit enforcement after N requests
- GET requests not rate limited
- Health endpoint shows Redis status

### 11. Write scenario tests for cached workflows
- Full create → cache → redirect → delete → invalidate → 404 workflow
- Rate limiting protects system from abuse
- Health check shows Redis connectivity
