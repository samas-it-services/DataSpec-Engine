# DataSpec Engine - E2E Tests

End-to-end tests using Playwright for the DataSpec Engine.

## Quick Start

```bash
# Install dependencies
npm install
npx playwright install chromium

# Run all tests
npm test

# Run with visible browser
npm run test:headed

# View HTML report
npm run report
```

## Prerequisites

- Node.js 18+
- Running API server (port 3000)
- Running Frontend server (port 3001)

### Start Required Servers

```bash
# Terminal 1: API Server
cd ../examples/full-stack-demo/api
npm install
npm run dev

# Terminal 2: Frontend Server
cd ../examples/full-stack-demo/frontend
npm install
npm run dev
```

Or use the auto-start feature (default when `SKIP_WEBSERVER` is not set).

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests headless |
| `npm run test:headed` | Run with visible browser |
| `npm run test:ui` | Interactive UI mode |
| `npm run test:api` | API-only tests |
| `npm run test:chrome` | Chromium browser |
| `npm run test:firefox` | Firefox browser |
| `npm run test:webkit` | Safari/WebKit |
| `npm run test:mobile` | Mobile viewport |
| `npm run report` | Open HTML report |

## Test Suites

| File | Tests | Description |
|------|-------|-------------|
| `tests/api.spec.ts` | 15 | API endpoint validation |
| `tests/import-flow.spec.ts` | 8 | Import wizard UI |
| `tests/export-flow.spec.ts` | 9 | Export functionality |
| `tests/masking.spec.ts` | 24 | Masking operations |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_API_URL` | `http://localhost:3000` | API server URL |
| `E2E_BASE_URL` | `http://localhost:3001` | Frontend URL |
| `SKIP_WEBSERVER` | `false` | Skip auto-starting servers |
| `CI` | - | CI mode (single worker) |

## Screenshots

Screenshots are captured automatically:
- **On test completion:** `test-results/*/test-finished-*.png`
- **On failure:** `test-results/*/test-failed-*.png`

## Project Structure

```
e2e/
├── tests/              # Test files
│   ├── api.spec.ts
│   ├── import-flow.spec.ts
│   ├── export-flow.spec.ts
│   └── masking.spec.ts
├── helpers/            # Test utilities
│   ├── api-client.ts
│   ├── global-setup.ts
│   └── global-teardown.ts
├── playwright.config.ts
├── package.json
└── README.md
```

## Related Documentation

- [Testing Guide](../docs/TESTING.md) - Comprehensive testing documentation
- [Test Reports](../docs/test-reports/) - Test results and screenshots
