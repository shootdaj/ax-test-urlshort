# Phase 2: Click Analytics — Plan

## Tasks

### Task 1: User-Agent Parser Utility
Create `src/utils/useragent.js` — a lightweight user-agent parser that extracts browser name and OS from user-agent strings. Pure function, no external dependencies.

### Task 2: Database Schema Updates
Update `src/db/schema.sql`:
- Add composite index on clicks(url_id, clicked_at)
- Add index on clicks(ip_address)
- Add index on clicks(referrer)

### Task 3: Non-blocking Click Recording
Refactor redirect handler in `src/routes/urls.js`:
- Make click recording fire-and-forget (don't await)
- Add try/catch around click recording so failures don't break redirect
- Store parsed browser/OS from user-agent

### Task 4: Enhanced Analytics Endpoint
Enhance `src/routes/analytics.js`:
- Add unique visitor count (COUNT DISTINCT ip_address)
- Add browser breakdown (parsed from user_agent)
- Add clicks-by-hour distribution
- Add query parameter filtering: ?start=YYYY-MM-DD&end=YYYY-MM-DD
- Add global summary endpoint: GET /api/analytics (total URLs, total clicks, top URLs)

### Task 5: Date Validation Utility
Add date validation to `src/utils/validation.js` for analytics query params.

### Task 6: Write Unit Tests for User-Agent Parser
Create `src/utils/useragent.test.js` — test all browser/OS detection cases.

### Task 7: Write Unit Tests for Analytics Route
Create `src/routes/analytics.test.js` — mock db, test all analytics endpoints and query params.

### Task 8: Write Unit Tests for Updated URL Routes
Update `src/routes/urls.test.js` — verify non-blocking click recording and metadata storage.

### Task 9: Write Integration Tests for Analytics
Add analytics integration tests to `test/integration/analytics.integration.test.js`.

### Task 10: Write Scenario Tests for Analytics Workflow
Add analytics scenario tests to `test/scenarios/analytics-workflow.scenario.test.js`.
