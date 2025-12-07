# DataSpec Engine - Validation Checklist

Use this checklist to validate all functionality of the DataSpec Engine.

---

## Prerequisites

Before running validation, ensure you have:

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Docker installed (for full-stack demo)
- [ ] Chrome/Chromium (for Playwright tests)

---

## 1. Initial Setup

```bash
# Clone and install dependencies
cd DataSpec-Engine
npm install

# Build all packages
npm run build
```

- [ ] All packages build without errors
- [ ] No TypeScript compilation errors

---

## 2. Unit Tests

### 2.1 Core Package Tests
```bash
cd packages/core
npm test
```

- [ ] All 320 tests pass
- [ ] Coverage ≥ 94%

### 2.2 Supabase Adapter Tests
```bash
cd packages/supabase-adapter
npm test
```

- [ ] All 120 tests pass
- [ ] Coverage ≥ 97%

### 2.3 React Package Tests
```bash
cd packages/react
npm test
```

- [ ] Tests run (72 passing, 4 skipped is acceptable)
- [ ] No critical failures

---

## 3. Shell Script Tests

### 3.1 Basic Import Example
```bash
chmod +x scripts/test-basic-import.sh
./scripts/test-basic-import.sh
```

- [ ] Script executes without errors
- [ ] CSV parsing works
- [ ] Validation results displayed
- [ ] Import preview shows correct row counts

### 3.2 API Tests
```bash
# Start API server first (in another terminal)
cd examples/full-stack-demo/api
npm install
npm run dev

# Then run API tests
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

- [ ] Health endpoint returns `status: ok`
- [ ] Entities endpoint returns entity list
- [ ] Specs endpoint returns specs
- [ ] Validate endpoint accepts YAML
- [ ] Preview endpoint processes CSV
- [ ] Mask endpoint masks values
- [ ] All tests pass (green checkmarks)

### 3.3 Full-Stack Demo
```bash
chmod +x scripts/test-fullstack-demo.sh
./scripts/test-fullstack-demo.sh
```

- [ ] API server starts
- [ ] All endpoints respond correctly
- [ ] Server shuts down cleanly

---

## 4. E2E Tests (Playwright)

### 4.1 Install Playwright
```bash
cd e2e
npm install
npx playwright install chromium
```

- [ ] Playwright installed
- [ ] Chromium browser downloaded

### 4.2 Run API Tests Only
```bash
# With API server running
npm run test:api
```

- [ ] Health check test passes
- [ ] Entities API tests pass
- [ ] Specs API tests pass
- [ ] YAML validation tests pass
- [ ] Import preview tests pass
- [ ] Export tests pass
- [ ] Masking tests pass

### 4.3 Run Full E2E Tests
```bash
# With both API and frontend running
npm test
```

- [ ] Import flow tests pass
- [ ] Export flow tests pass
- [ ] Masking flow tests pass

---

## 5. Performance Validation

### 5.1 Preview Performance (200 rows < 1 second)
```bash
# Create test with 200 rows
node -e "
const { StreamingCSVParser, PerformanceMonitor } = require('./packages/core/dist');
const monitor = new PerformanceMonitor();
const parser = new StreamingCSVParser();

// Generate 200 row CSV
let csv = 'name,email,phone\n';
for(let i=0; i<200; i++) {
  csv += \`User\${i},user\${i}@test.com,555-000-\${i.toString().padStart(4,'0')}\n\`;
}

monitor.start();
const result = parser.parse(csv);
monitor.stop();

console.log('Rows:', result.totalRows);
console.log('Time:', monitor.getMetrics().totalDuration.toFixed(2), 'ms');
console.log('Target: < 1000ms');
console.log('PASS:', monitor.getMetrics().totalDuration < 1000 ? '✓' : '✗');
"
```

- [ ] 200 rows parsed in < 1 second

### 5.2 Large File Performance (10k rows)
```bash
node -e "
const { StreamingCSVParser, PerformanceMonitor } = require('./packages/core/dist');
const monitor = new PerformanceMonitor();
const parser = new StreamingCSVParser();

let csv = 'name,email,phone\n';
for(let i=0; i<10000; i++) {
  csv += \`User\${i},user\${i}@test.com,555-000-\${i.toString().padStart(4,'0')}\n\`;
}

monitor.start();
const result = parser.parse(csv);
monitor.stop();

console.log('Rows:', result.totalRows);
console.log('Time:', (monitor.getMetrics().totalDuration/1000).toFixed(2), 'seconds');
console.log('Target: < 30 seconds');
console.log('PASS:', monitor.getMetrics().totalDuration < 30000 ? '✓' : '✗');
"
```

- [ ] 10k rows processed in < 30 seconds

---

## 6. Export Formats Validation

### 6.1 XML Export
```bash
node -e "
const { XMLExporter } = require('./packages/core/dist');

const spec = {
  metadata: { entity: 'users', name: 'test' },
  columns: [
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' }
  ]
};

const exporter = new XMLExporter({ spec });
const result = await exporter.export({
  spec,
  rows: [
    { name: 'John', email: 'john@test.com' },
    { name: 'Jane', email: 'jane@test.com' }
  ]
});

console.log('Format:', result.format);
console.log('Success:', result.success);
console.log('Rows:', result.rowCount);
console.log('XML Preview:', result.data.substring(0, 200) + '...');
"
```

- [ ] XML export generates valid XML
- [ ] Contains all rows
- [ ] Proper XML declaration

### 6.2 Parquet Export
```bash
node -e "
const { ParquetExporter } = require('./packages/core/dist');

const spec = {
  metadata: { entity: 'users', name: 'test' },
  columns: [
    { name: 'id', type: 'integer' },
    { name: 'name', type: 'string' }
  ]
};

const exporter = new ParquetExporter({ spec });
const result = await exporter.export({
  spec,
  rows: [
    { id: 1, name: 'John' },
    { id: 2, name: 'Jane' }
  ]
});

console.log('Format:', result.format);
console.log('Success:', result.success);
console.log('Schema:', JSON.stringify(result.data.schema, null, 2));
"
```

- [ ] Parquet export generates schema
- [ ] Columnar data structure correct
- [ ] Type mappings work

### 6.3 Google Sheets Export (Format Only)
```bash
node -e "
const { GoogleSheetsExporter } = require('./packages/core/dist');

const spec = {
  metadata: { entity: 'users', name: 'test' },
  columns: [
    { name: 'name', type: 'string' },
    { name: 'email', type: 'string' }
  ]
};

const exporter = new GoogleSheetsExporter({ spec });
const result = await exporter.export({
  spec,
  rows: [
    { name: 'John', email: 'john@test.com' }
  ],
  options: { includeHeaders: true }
});

console.log('Format:', result.format);
console.log('Success:', result.success);
console.log('Sheet Data:', JSON.stringify(result.data.sheetData));
"
```

- [ ] Google Sheets format export works
- [ ] 2D array format correct
- [ ] Headers included

---

## 7. LRU Cache Validation

```bash
node -e "
const { LRUCache } = require('./packages/core/dist');

const cache = new LRUCache({ maxSize: 3, ttl: 5000 });

cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);
console.log('Size after 3 items:', cache.size);

cache.set('d', 4); // Should evict 'a'
console.log('Size after 4th item:', cache.size);
console.log('Key a exists:', cache.has('a')); // Should be false
console.log('Key d exists:', cache.has('d')); // Should be true

const stats = cache.getStats();
console.log('Stats:', JSON.stringify(stats));
console.log('PASS:', cache.size === 3 && !cache.has('a') && cache.has('d') ? '✓' : '✗');
"
```

- [ ] Cache respects max size
- [ ] LRU eviction works
- [ ] Statistics tracked correctly

---

## 8. Docker Deployment (Optional)

### 8.1 Build Docker Image
```bash
cd packages/api
docker build -t dataspec-api .
```

- [ ] Docker image builds successfully

### 8.2 Run Container
```bash
docker run -p 3000:3000 dataspec-api
```

- [ ] Container starts
- [ ] Health endpoint accessible at `http://localhost:3000/health`

### 8.3 Docker Compose
```bash
cd examples/full-stack-demo
docker-compose up
```

- [ ] All services start
- [ ] API accessible
- [ ] Frontend accessible

---

## 9. Integration Examples

### 9.1 Basic Import Example
```bash
cd examples/basic-import
npm install
npm start
```

- [ ] Sample CSV imports successfully
- [ ] Validation errors displayed
- [ ] Preview shows correct data

### 9.2 Full-Stack Demo
```bash
cd examples/full-stack-demo
# Start API
cd api && npm install && npm run dev &
# Start Frontend
cd ../frontend && npm install && npm run dev
```

- [ ] API server runs on port 3000
- [ ] Frontend runs on port 3001
- [ ] Import wizard loads
- [ ] Can select entity and spec
- [ ] File upload works

---

## 10. Final Checklist

### Code Quality
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] No ESLint warnings (if configured)

### Documentation
- [ ] IMPLEMENTATION-PLAN.md is current
- [ ] README files exist for each package
- [ ] API endpoints documented

### Functionality
- [ ] Import preview works
- [ ] Import execute works
- [ ] Export to all formats works
- [ ] Masking/unmasking works
- [ ] Validation rules work
- [ ] Transformations work
- [ ] Lookups work (with cache)

### Performance
- [ ] 200 row preview < 1 second
- [ ] 10k row import < 30 seconds
- [ ] LRU cache improves lookup performance

### Security
- [ ] Sensitive fields masked by default
- [ ] Unmask requires proper permissions
- [ ] JWT authentication works on protected endpoints

---

## Quick Validation Commands

Run these for a quick validation:

```bash
# 1. Build everything
npm run build

# 2. Run all unit tests
npm test

# 3. Run API tests
./scripts/test-api.sh

# 4. Run E2E tests (with servers running)
cd e2e && npm test

# 5. Check performance
node -e "console.log(require('./packages/core/dist').PerformanceMonitor ? '✓ Performance utils loaded' : '✗')"
node -e "console.log(require('./packages/core/dist').XMLExporter ? '✓ XML Exporter loaded' : '✗')"
node -e "console.log(require('./packages/core/dist').ParquetExporter ? '✓ Parquet Exporter loaded' : '✗')"
node -e "console.log(require('./packages/core/dist').GoogleSheetsExporter ? '✓ Google Sheets Exporter loaded' : '✗')"
```

---

## Troubleshooting

### Tests failing with module not found
```bash
npm run build  # Rebuild all packages
```

### Playwright tests failing
```bash
npx playwright install  # Install all browsers
```

### Docker build failing
```bash
# Ensure you're in the right directory
cd packages/api
docker build --no-cache -t dataspec-api .
```

### Port already in use
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>
```
