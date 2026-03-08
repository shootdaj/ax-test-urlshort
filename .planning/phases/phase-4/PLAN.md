# Phase 4 Plan: Testing and Hardening

## Task 1: Add request body size limit
- Add `{ limit: '10kb' }` option to `express.json()` in `src/index.js`
- This prevents denial-of-service via oversized payloads

## Task 2: Add URL length validation
- In `validateUrl()`, reject URLs longer than 2048 characters
- This is a standard browser URL length limit

## Task 3: Add slug param validation middleware
- Create `validateSlugParam()` middleware that validates `:slug` params on read/delete routes
- Apply to GET /:slug, GET /:slug/info, DELETE /:slug in `src/routes/urls.js`
- Apply to GET /:slug in `src/routes/analytics.js`

## Task 4: Sanitize stored metadata
- Truncate user-agent to 512 chars before storing
- Truncate referrer to 2048 chars before storing
- Validate/truncate IP address to 45 chars (IPv6 max)

## Task 5: Harden error handler
- Don't log full stack traces in production (check NODE_ENV)
- Return generic error for all unhandled errors (already done, but add test)

## Task 6: Add open redirect protection
- Before redirecting, re-validate that the stored URL uses http/https scheme
- This protects against any future DB corruption or direct DB manipulation

## Task 7: Add security-focused validation edge case tests
- Test javascript: URLs are rejected
- Test data: URLs are rejected
- Test extremely long URLs are rejected
- Test unicode/emoji in slugs are rejected
- Test null bytes in URL/slug
- Test body size limit enforcement
- Test slug param validation on GET/DELETE routes

## Task 8: Add missing unit tests for app-level wiring
- Health endpoint test
- Test that Helmet headers are present
- Test that JSON body parsing works
- Test 404 for unknown routes

## Task 9: Write security hardening scenario test
- End-to-end scenario covering all security measures
- XSS in URL/slug, oversized body, invalid protocols, etc.

## Task 10: Run full test pyramid and verify
- Run all unit tests
- Report results
