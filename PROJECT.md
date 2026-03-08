# URL Shortener API

A URL shortening service with click analytics, built with Node.js, Express, and PostgreSQL.

## Goals
- Shorten URLs with custom or auto-generated slugs
- Track clicks with referrer, user-agent, and IP analytics
- Provide analytics dashboard API for URL owners
- Redis caching for high-traffic redirects
- Rate limiting to prevent abuse

## Tech Stack
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Testing:** Vitest + Supertest
