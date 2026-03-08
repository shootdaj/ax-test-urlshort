# Phase 4: Testing and Hardening — Context

## Phase Goal
Comprehensive test coverage and security hardening for the URL shortener API.

## Current State
- Phases 1-3 complete: Core API, click analytics, Redis caching, rate limiting
- Existing test pyramid: ~100+ unit tests, integration and scenario tests written (need Docker to run)
- Validation exists for URL format, slug format, and date params
- Helmet.js already in place for basic HTTP security headers

## Security Audit Findings

### Critical
1. **No request body size limit** — `express.json()` accepts unlimited payloads, enabling denial-of-service
2. **No URL length limit** — can store arbitrarily long URLs in DB
3. **Open redirect risk** — redirect endpoint doesn't re-validate the stored URL before redirecting
4. **Error handler leaks stack traces** — `console.error(err.stack)` runs in all environments; 500 response is safe but logs could leak info

### Medium
5. **Slug params not validated on read paths** — GET /:slug, GET /:slug/info, DELETE /:slug don't validate slug format
6. **Referrer stored raw** — no length/content sanitization
7. **User-agent stored raw** — no length limit, could store huge strings
8. **IP address not validated** — stored as-is from req.ip

### Low
9. **No protection against javascript:/data: URLs** — validation covers this (http/https only), but should have explicit tests
10. **Missing edge case validation tests** — Unicode, very long URLs, boundary conditions

## Testing Requirements (AX)

All new functionality in this phase MUST include:
- **Unit tests** for all new functions/methods (mock external deps)
- **Integration tests** for all new API endpoints, DB operations, and service integrations
- **Scenario tests** for all new user-facing workflows

Test naming: `Test<Component>_<Behavior>[_<Condition>]`
Reference: TEST_GUIDE.md for requirement mapping, .claude/ax/references/testing-pyramid.md for methodology
