# Phase 1 Plan: Core API and Database

## Task 1: Fix nanoid Compatibility
nanoid v5 is ESM-only but the project uses CommonJS. Replace with a CommonJS-compatible slug generation approach.
- Replace `nanoid` import with a compatible alternative or downgrade
- Ensure slug generation works correctly

## Task 2: Create Schema Migration Runner
- Create `src/db/migrate.js` that reads schema.sql and executes it
- Add migration call to app startup (optional, controlled by env var)
- Export a `runMigrations()` function for use in tests

## Task 3: Add URL Validation
- Validate URL format in POST /api/urls (must be a valid HTTP/HTTPS URL)
- Validate custom slug format (alphanumeric + hyphens, 3-32 chars)
- Return 400 with descriptive error messages

## Task 4: Improve Error Handling
- Add specific error responses for different failure modes
- Ensure consistent error response format: `{ error: string }`

## Task 5: Add GET /api/urls/:slug/info Endpoint
- Return URL metadata without redirecting (for API consumers)
- Separate from the redirect endpoint

## Task 6: Write Unit Tests for URL Routes
- Test POST / — successful creation with generated slug
- Test POST / — successful creation with custom slug
- Test POST / — validation errors (missing URL, invalid URL, invalid slug)
- Test GET /:slug — successful redirect
- Test GET /:slug — 404 for unknown slug
- Test GET / — list URLs
- Test DELETE /:slug — successful deletion
- Test DELETE /:slug — 404 for unknown slug
- Mock db/pool for all unit tests

## Task 7: Write Unit Tests for Error Handler
- Test 23505 error code returns 409
- Test generic errors return 500

## Task 8: Write Unit Tests for Migration Runner
- Test that migrate function reads and executes SQL
- Mock fs and pool

## Task 9: Write Integration Tests
- Test URL creation with real database
- Test redirect with real database
- Test slug conflict detection with real database
- Test URL deletion with cascade (clicks removed)
- Test listing URLs

## Task 10: Write Scenario Tests
- Test full URL shortening workflow: create -> redirect -> verify click recorded -> delete
- Test custom slug workflow: create with custom slug -> redirect -> delete
- Test conflict handling: create -> attempt duplicate custom slug -> get 409
