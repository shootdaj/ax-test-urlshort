# URL Shortener API

A URL shortening service with click analytics, Redis caching, and rate limiting. Built with Node.js, Express, and PostgreSQL.

## Current State

**Version:** v1.0 (shipped 2026-03-09)
**Status:** MVP complete -- all 16 requirements delivered across 4 phases.

### What Shipped in v1.0
- URL shortening with auto-generated (nanoid) and custom slugs
- 301 redirects with non-blocking click recording
- Full analytics API: total clicks, clicks-by-day, clicks-by-hour, top referrers, browser breakdown, unique visitors, date range filtering
- Redis cache-aside pattern for redirect lookups with graceful degradation
- Fixed-window rate limiting on URL creation endpoint
- Security hardening: Helmet, CORS, input validation, open redirect protection, request size limits

## Tech Stack
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Testing:** Vitest + Supertest
- **Production code:** 740 LOC across 11 source files
- **Test coverage:** 173 unit tests, 25 integration tests, 20 scenario tests

## Known Technical Debt
- nanoid v3.x (CJS); v5+ is ESM-only and will require migration
- Integration/scenario tests need live PostgreSQL + Redis (Docker) to run

---
*Last updated: 2026-03-09 after v1.0 milestone*
