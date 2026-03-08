# Roadmap

## Phase 1: Core API and Database
Set up database schema, URL CRUD operations, and redirect endpoint.
- Implement schema.sql migration runner
- URL creation with nanoid slug generation
- Custom slug support with conflict detection
- Redirect endpoint with 301 response
- Basic error handling

## Phase 2: Click Analytics
Add click tracking and analytics API.
- Record clicks on redirect with metadata
- Analytics endpoint: total clicks, clicks-by-day, top referrers
- Database indexes for analytics queries

## Phase 3: Redis Caching and Rate Limiting
Add Redis caching layer and rate limiting.
- Redis cache for URL lookups (cache-aside pattern)
- Cache invalidation on URL delete
- Rate limiting middleware on POST /api/urls
- Health check for Redis connectivity

## Phase 4: Testing and Hardening
Comprehensive test coverage and security hardening.
- Unit tests for all route handlers
- Integration tests with real PostgreSQL
- Scenario tests for full user workflows
- Input validation (URL format, slug format)
- Security audit and fixes
