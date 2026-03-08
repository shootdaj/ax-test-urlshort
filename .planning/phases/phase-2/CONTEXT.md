# Phase 2: Click Analytics — Context

## Phase Goal
Add click tracking enhancements and analytics API improvements.

## Current State
Phase 1 established the core API with:
- URL CRUD operations (create, read, list, delete)
- Basic redirect with click recording (url_id, referrer, user_agent, ip_address)
- Basic analytics endpoint at GET /api/analytics/:slug (total clicks, clicks-by-day, top referrers)
- Database schema with urls and clicks tables, basic indexes

## What Needs to Be Done

### 1. Enhanced Click Metadata
- Parse user-agent to extract browser and OS information
- Store parsed metadata alongside raw user-agent
- Track country from IP (lightweight, no external service — just store IP for now)

### 2. Analytics Endpoint Improvements
- Add unique visitor count (by IP)
- Add user-agent/browser breakdown
- Add clicks-by-hour distribution
- Add date range filtering via query parameters (start, end)
- Add global analytics summary endpoint (GET /api/analytics — all URLs)

### 3. Database Indexes for Analytics
- Add composite index on clicks(url_id, clicked_at) for date-range queries
- Add index on clicks(ip_address) for unique visitor queries
- Add index on clicks(referrer) for referrer aggregation queries

### 4. Click Recording Improvements
- Make click recording non-blocking (don't delay redirect response)
- Add error resilience (click recording failure shouldn't break redirect)

## Testing Requirements (AX)

All new functionality in this phase MUST include:
- **Unit tests** for all new functions/methods (mock external deps)
- **Integration tests** for all new API endpoints, DB operations, and service integrations
- **Scenario tests** for all new user-facing workflows

Test naming: `Test<Component>_<Behavior>[_<Condition>]`
Reference: TEST_GUIDE.md for requirement mapping, .claude/ax/references/testing-pyramid.md for methodology
