# Phase 3: Redis Caching and Rate Limiting

## Goal
Add Redis caching layer for URL lookups and rate limiting middleware for URL creation.

## Requirements
1. Redis cache for URL lookups (cache-aside pattern)
2. Cache invalidation on URL delete
3. Rate limiting middleware on POST /api/urls
4. Health check for Redis connectivity

## Key Decisions
- Cache-aside pattern: check cache first, fall back to DB, populate cache on miss
- Graceful degradation: all features work without Redis (fail open)
- Rate limiting uses fixed window counter per IP (60s window, 10 requests max)
- Rate limit headers included in responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- Cache TTL: 1 hour default

## Testing Requirements (AX)

All new functionality in this phase MUST include:
- **Unit tests** for all new functions/methods (mock external deps)
- **Integration tests** for all new API endpoints, DB operations, and service integrations
- **Scenario tests** for all new user-facing workflows

Test naming: `Test<Component>_<Behavior>[_<Condition>]`
Reference: TEST_GUIDE.md for requirement mapping, .claude/ax/references/testing-pyramid.md for methodology
