# URL Shortener - Project Instructions

## Testing Requirements

All code changes MUST include appropriate tests. Follow the testing pyramid:

### Test Pyramid
1. **Unit Tests** (`src/` - colocated with source): Test individual functions and modules in isolation. No external dependencies.
2. **Integration Tests** (`test/integration/`): Test interactions between components with real database and cache connections.
3. **Scenario Tests** (`test/scenarios/`): End-to-end tests that exercise full API workflows.

### Running Tests
```bash
# Unit tests (fast, no dependencies)
npx vitest run --dir src

# Start test infrastructure
docker compose -f docker-compose.test.yml up -d --wait

# Integration tests (requires postgres + redis)
npx vitest run --dir test/integration

# Scenario tests (requires postgres + redis)
npx vitest run --dir test/scenarios

# Stop test infrastructure
docker compose -f docker-compose.test.yml down -v
```

### Rules
- Every new feature MUST have unit tests
- Every new API endpoint MUST have integration tests
- Every user-facing workflow MUST have scenario tests
- Tests must pass before requesting review
- Do not skip or disable tests without documenting why

## Stack
- **Runtime:** Node.js 20
- **Framework:** Express
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Test Framework:** vitest
- **Package Manager:** npm
