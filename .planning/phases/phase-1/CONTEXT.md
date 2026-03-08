# Phase 1 Context: Core API and Database

## Phase Goal
Set up database schema, URL CRUD operations, and redirect endpoint.

## Requirements
1. Implement schema.sql migration runner — ensure database tables are created on startup
2. URL creation with nanoid slug generation — POST /api/urls creates short URLs
3. Custom slug support with conflict detection — users can specify their own slug
4. Redirect endpoint with 301 response — GET /api/urls/:slug redirects to original URL
5. Basic error handling — 400 for missing URL, 404 for not found, 409 for slug conflict

## Existing Code Analysis
The project already has significant scaffolding:
- `src/index.js` — Express app with helmet, cors, morgan, health check
- `src/routes/urls.js` — URL CRUD routes (create, redirect, list, delete)
- `src/routes/analytics.js` — Analytics routes (Phase 2 scope)
- `src/db/pool.js` — PostgreSQL connection pool
- `src/db/schema.sql` — DDL for urls and clicks tables
- `src/middleware/errors.js` — Error handler with 23505 (unique violation) handling

## What Needs to Be Done
1. **Schema migration runner** — The schema.sql exists but there's no code to run it on startup. Need a `migrate.js` utility.
2. **URL validation** — The POST route doesn't validate URL format.
3. **Slug validation** — No validation for custom slug format (length, allowed characters).
4. **nanoid compatibility** — nanoid v5 is ESM-only; need to verify/fix the import.
5. **Unit tests** — `src/routes/urls.test.js` is a placeholder. Need real unit tests.
6. **Integration tests** — No integration tests exist. Need tests with real DB.
7. **Scenario tests** — No scenario tests exist. Need end-to-end workflow tests.

## Technical Decisions
- Migration runner: simple file-read + pool.query approach
- nanoid v5 is ESM-only but project uses CommonJS (require). Will use nanoid v3 or a compatible approach.
- Unit tests mock the db/pool module
- Integration tests use real PostgreSQL via docker-compose

## Testing Requirements (AX)

All new functionality in this phase MUST include:
- **Unit tests** for all new functions/methods (mock external deps)
- **Integration tests** for all new API endpoints, DB operations, and service integrations
- **Scenario tests** for all new user-facing workflows

Test naming: `Test<Component>_<Behavior>[_<Condition>]`
Reference: TEST_GUIDE.md for requirement mapping, .claude/ax/references/testing-pyramid.md for methodology
