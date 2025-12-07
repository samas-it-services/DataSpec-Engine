# DataSpec Engine - Testing Guide

Complete guide for running unit tests, E2E tests, and generating test reports.

## Quick Start

```bash
# Run all unit tests
npm test

# Run E2E tests (requires servers to be running)
cd e2e && npm test

# View Playwright HTML report
cd e2e && npm run report
```

---

## Unit Tests (Jest)

### Run All Tests

```bash
npm test
```

This runs tests for all packages using Turborepo for parallel execution.

### Run Specific Package

```bash
# Core package (YAML parser, transformers, masking)
npm test --workspace=@dataspec-engine/core

# Supabase adapter (database integration)
npm test --workspace=@dataspec-engine/supabase-adapter

# React UI components
npm test --workspace=@dataspec-engine/react

# API package
npm test --workspace=@dataspec-engine/api
```

### With Coverage

```bash
npm test -- --coverage
```

Coverage reports are generated in `packages/*/coverage/`.

### Watch Mode

```bash
npm test --workspace=@dataspec-engine/core -- --watch
```

---

## E2E Tests (Playwright)

E2E tests validate the full application flow using Playwright.

### Prerequisites

- Node.js 18+
- Chrome/Chromium browser (installed via Playwright)

### Installation

```bash
cd e2e
npm install
npx playwright install chromium
```

### Running Tests

#### Start Required Servers

Before running E2E tests, start the API and frontend servers:

```bash
# Terminal 1: Start API server
cd examples/full-stack-demo/api
npm install
npm run dev

# Terminal 2: Start Frontend server
cd examples/full-stack-demo/frontend
npm install
npm run dev
```

#### Run Tests

```bash
cd e2e

# All tests (headless)
npm test

# With visible browser
npm run test:headed

# Interactive UI mode
npm run test:ui

# API tests only
npm run test:api

# Specific browser
npm run test:chrome
npm run test:firefox
npm run test:webkit

# Mobile viewport
npm run test:mobile
```

#### Run Without Auto-Starting Servers

If servers are already running:

```bash
SKIP_WEBSERVER=true npm test
```

### View Test Reports

```bash
cd e2e
npm run report
```

This opens the HTML report in your default browser.

### Screenshots

Screenshots are automatically captured for all tests (configured in `playwright.config.ts`).

- **Location:** `e2e/test-results/`
- **Documentation screenshots:** `docs/test-reports/screenshots/`

---

## Test Suites

### Unit Test Coverage

| Package | Tests | Coverage |
|---------|-------|----------|
| @dataspec-engine/core | 200 | 94.26% |
| @dataspec-engine/supabase-adapter | 120 | 97.22% |
| @dataspec-engine/react | 76 | - |
| @dataspec-engine/api | - | - |
| **Total** | **396** | **95%+** |

### E2E Test Coverage

| Test Suite | Tests | Description |
|------------|-------|-------------|
| api.spec.ts | 15 | API endpoint validation |
| import-flow.spec.ts | 8 | Import wizard UI flow |
| export-flow.spec.ts | 9 | Export functionality |
| masking.spec.ts | 24+ | Security & masking tests |

---

## Integration Tests

Shell scripts for testing examples:

```bash
# API integration tests
./scripts/test-api.sh

# Example projects tests
./scripts/test-examples.sh

# Full-stack demo tests
./scripts/test-fullstack-demo.sh
```

---

## CI/CD Integration

Tests run via Turborepo for parallel execution:

```bash
# Run all tests
turbo test

# With caching
turbo test --cache

# Build first, then test
turbo build && turbo test
```

---

## Test Configuration Files

| File | Description |
|------|-------------|
| `jest.config.js` | Root Jest configuration |
| `packages/*/jest.config.js` | Package-specific Jest configs |
| `e2e/playwright.config.ts` | Playwright E2E configuration |
| `turbo.json` | Turborepo pipeline configuration |

---

## Troubleshooting

### Tests failing with "module not found"

```bash
# Rebuild all packages
npm run build
```

### Playwright tests failing

```bash
# Reinstall browsers
npx playwright install

# Install specific browser
npx playwright install chromium
```

### Port already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Tests timing out

```bash
# Increase timeout
npx playwright test --timeout=60000
```

### React test snapshot issues

```bash
# Update snapshots
npm test --workspace=@dataspec-engine/react -- -u
```

---

## Writing Tests

### Unit Tests (Jest)

```typescript
// packages/core/src/__tests__/MyComponent.test.ts
import { myFunction } from '../myModule';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/tests/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should work correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Expected');
  });
});
```

---

## Related Documentation

- [Test Results](./TEST-RESULTS.md) - Coverage metrics and history
- [Test Reports](./test-reports/) - E2E reports and QA certification
- [Validation Checklist](./VALIDATION-CHECKLIST.md) - PRD compliance validation
- [E2E Quick Start](../e2e/README.md) - E2E-specific documentation
