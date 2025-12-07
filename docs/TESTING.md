# DataSpec Engine - Testing Philosophy & Comprehensive Guide

> "In data operations, a bug isn't just an inconvenience—it's potentially thousands of corrupted records, exposed sensitive data, or compliance violations."

**Total Tests:** 392+ | **Coverage:** 94%+ | **E2E Tests:** 56

---

## Table of Contents

1. [Why We Test So Rigorously](#why-we-test-so-rigorously)
2. [Test Categories](#test-categories)
3. [The Test Pyramid](#the-test-pyramid)
4. [Running Tests](#running-tests)
5. [Auto-Generated Reports](#auto-generated-reports)
6. [Test Coverage Goals](#test-coverage-goals)
7. [Adding New Tests](#adding-new-tests)
8. [Troubleshooting](#troubleshooting)

---

## Why We Test So Rigorously

DataSpec Engine handles **high-stakes data operations**. Unlike a UI bug that causes a button to look wrong, bugs in data import/export can have catastrophic consequences.

### The Real Cost of Data Bugs

| Scenario | Impact | Real-World Consequence |
|----------|--------|------------------------|
| **Transformation Bug** | 10,000 phone numbers formatted incorrectly | Customer support can't reach anyone for weeks |
| **Masking Failure** | SSNs exposed in export | GDPR fine: up to €20M or 4% of annual revenue |
| **Validation Bypass** | Invalid emails inserted | Marketing campaigns bounce, sender reputation destroyed |
| **Lookup Error** | Wrong foreign keys assigned | Orders linked to wrong customers, legal liability |
| **Import Duplication** | Same records inserted twice | Financial reports doubled, audit failures |
| **Partial Commit** | Half of batch inserted | Database in inconsistent state, manual cleanup |

### Why Other Solutions Fail

Most data import tools are tested minimally because:
- "It's just moving data around"
- "We'll catch issues in QA"
- "Users will report problems"

**This approach fails spectacularly when:**
- You import 50,000 records and discover the bug after commit
- A privacy violation is discovered by a customer, not QA
- The "minor bug" affects every record in your database

**Our approach:** Test every code path before it ever touches real data.

---

## Test Categories

We organize our 392+ tests into logical categories, each protecting against specific types of failures.

### Category 1: Data Integrity Tests (145 tests)

**What We Protect Against:** Data corruption, data loss, incorrect transformations

These tests ensure your data arrives in the database exactly as intended—no silent corruption, no mangled values, no lost precision.

#### Field Transformer Tests (55 tests)

| Test Group | Tests | Real-World Protection |
|------------|-------|----------------------|
| String Operations | 12 | `"  John Doe  "` → `"John Doe"` (trim works correctly) |
| Case Transformations | 8 | `"JOHN DOE"` → `"John Doe"` (proper capitalization) |
| Date Parsing | 15 | `"25/12/2023"` not confused with US format `"12/25/2023"` |
| Number Handling | 10 | `"$1,234.56"` → `1234.56` (currency symbols removed correctly) |
| Phone Normalization | 10 | `"+1 (555) 123-4567"` → `"+15551234567"` (consistent format) |

**Example: Why Date Parsing Tests Matter**

```
Input: "01/02/2024"
Without proper testing: Could be January 2nd OR February 1st
With our tests: Format explicitly specified, no ambiguity

✓ should parse DD/MM/YYYY correctly
✓ should parse MM/DD/YYYY correctly
✓ should parse YYYY-MM-DD correctly
✓ should reject ambiguous formats without explicit format
✓ should handle leap years correctly
```

#### Import Executor Tests (50 tests)

| Test Group | Tests | What Could Go Wrong |
|------------|-------|---------------------|
| Batch Processing | 15 | Partial batch commits leaving database inconsistent |
| Transaction Handling | 12 | Rollback failures leaving orphan records |
| Error Recovery | 10 | Single bad row crashing entire import |
| Progress Tracking | 8 | Incorrect progress reporting to users |
| Duplicate Handling | 5 | Same record inserted multiple times |

**Example: Why Batch Tests Matter**

Importing 50,000 records in batches of 1,000:
```
Batch 1-10: ✓ Success
Batch 11:   ✗ Database connection lost
Batch 12-50: Never executed

Without proper testing:
  - 10,000 records inserted, 40,000 missing
  - No way to know which records made it
  - Manual cleanup required

With our tests:
  ✓ should rollback entire import on batch failure
  ✓ should track which rows were processed
  ✓ should resume from last successful batch
  ✓ should report exact failure point
```

#### Lookup Resolver Tests (40 tests)

| Test Group | Tests | Protection Provided |
|------------|-------|---------------------|
| Single Key Lookups | 12 | Customer "John Smith" → correct `customer_id` |
| Composite Key Lookups | 10 | First + Last name → unique person ID |
| Missing Reference Handling | 8 | What happens when lookup fails |
| Fallback Strategies | 10 | Create new record vs. reject row |

---

### Category 2: Security & Privacy Tests (95 tests)

**What We Protect Against:** Data exposure, unauthorized access, compliance violations

A single masking bug in an export could expose thousands of SSNs. These tests ensure that never happens.

#### Masking Engine Tests (50 tests)

| Test Group | Tests | What's Protected |
|------------|-------|------------------|
| Full Masking | 12 | `"123-45-6789"` → `"*********"` |
| Partial Masking | 15 | `"4111111111111111"` → `"************1111"` |
| Regex Masking | 10 | `"john@example.com"` → `"****@example.com"` |
| Edge Cases | 13 | Empty strings, unicode, special characters |

**Example Test Cases:**

```typescript
// Full Masking
✓ should mask SSN completely: "123-45-6789" → "*********"
✓ should mask salary: "$150,000" → "********"
✓ should handle empty string gracefully

// Partial Masking
✓ should show last 4 digits of credit card: "4111111111111111" → "************1111"
✓ should show last 4 digits of SSN: "123-45-6789" → "***-**-6789"
✓ should handle strings shorter than visible portion

// Regex Masking
✓ should mask email local part: "john.doe@example.com" → "********@example.com"
✓ should mask phone area code: "(555) 123-4567" → "(***) 123-4567"
```

#### RLS Validator Tests (35 tests)

| Test Group | Tests | Protection |
|------------|-------|------------|
| Role Checking | 15 | User A can't see User B's data |
| Permission Validation | 10 | Only HR can view salaries |
| Audit Requirements | 10 | Every access attempt logged |

#### Audit Logger Tests (10 tests)

| Test | Purpose |
|------|---------|
| Log unmask operations | Who viewed what sensitive data |
| Include timestamps | When did the access occur |
| Record justification | Why was access needed |
| Prevent log tampering | Logs can't be deleted |

---

### Category 3: Specification & Validation Tests (76 tests)

**What We Protect Against:** Invalid configurations, runtime errors, unclear failures

A YAML spec error discovered during a production import means stopping everything, fixing specs under pressure, and explaining to stakeholders why their data load failed.

#### YAML Parser Tests (45 tests)

| Test Group | Tests | Protection |
|------------|-------|------------|
| Basic Parsing | 10 | Valid YAML is parsed correctly |
| Schema Validation | 15 | Required fields enforced |
| Error Messages | 10 | Clear error for invalid specs |
| Edge Cases | 10 | Complex nested structures, anchors |

**Why Clear Error Messages Matter:**

```yaml
# Bad error message:
"Parse error at line 47"

# Good error message (what we test for):
"Field 'customer_id' requires a lookup configuration but none provided.
 Add a 'lookup' block with 'table', 'match', and 'return' fields.
 See: docs/yaml-spec-guide.md#lookups"
```

#### Schema Validator Tests (31 tests)

| Validation | Tests | Example |
|------------|-------|---------|
| Required Fields | 8 | `entity` field must exist |
| Type Checking | 10 | `sensitivity` must be valid enum |
| Logical Validation | 8 | Can't have `lookup` without `table` |
| Dependency Checking | 5 | Circular lookups detected |

---

### Category 4: Hook System Tests (45 tests)

**What We Protect Against:** Custom logic failures, integration issues

Hooks enable custom business logic. If they fail silently, your business rules aren't applied.

#### Hook Execution Tests

| Hook Point | Tests | When It Fires |
|------------|-------|---------------|
| `beforeValidateRow` | 8 | Before validation, can modify/reject |
| `validateField` | 5 | Custom field validation |
| `beforeLookup` | 5 | Before foreign key resolution |
| `performLookup` | 5 | Custom lookup logic |
| `transformField` | 5 | Custom transformation |
| `maskField` | 5 | Custom masking logic |
| `beforeInsert` | 5 | Final modification before DB |
| `afterInsert` | 5 | Post-insert triggers |
| `Error Handling` | 7 | Hook exceptions don't crash import |

**Example: Why Hook Tests Matter**

```typescript
// Your custom validation hook
async function validateEmployeeId(value, context) {
  const exists = await checkEmployeeExists(value);
  if (!exists) {
    throw new Error(`Employee ${value} not found`);
  }
  return value;
}

// Our tests ensure:
✓ Hook receives correct context (rowIndex, fieldName, etc.)
✓ Hook can reject row with clear error
✓ Hook exception doesn't crash entire import
✓ Hook errors are logged and reported
✓ Hook can modify value before insert
```

---

### Category 5: UI Component Tests (76 tests)

**What We Protect Against:** User interface failures, state management bugs

#### React Component Tests

| Component | Tests | What's Tested |
|-----------|-------|---------------|
| DataSpecContext | 22 | Global state management |
| EntitySelector | 18 | Entity selection, loading states |
| FileUpload | 12 | File validation, size limits |
| PreviewTable | 8 | Data display, masking indicators |
| ImportProgress | 6 | Progress tracking, error display |
| Hooks | 10 | useImport, useExport, useDataSpec |

**Example: FileUpload Tests**

```
✓ should accept valid CSV file
✓ should accept valid XLSX file
✓ should reject file over size limit (10MB default)
✓ should reject non-CSV/XLSX files
✓ should show file name after selection
✓ should show file size in human-readable format
✓ should allow drag and drop
✓ should show upload progress
✓ should handle upload cancellation
✓ should show clear error for rejected files
```

---

### Category 6: E2E Workflow Tests (56 tests)

**What We Protect Against:** Integration failures, complete workflow breaks

Unit tests can pass while the full flow fails. E2E tests catch issues that only appear when components work together.

#### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| API Endpoints | 15 | Health, entities, specs, preview, execute |
| Import Flow | 8 | Upload → Preview → Validate → Execute |
| Export Flow | 9 | Select → Configure → Mask → Download |
| Masking Operations | 24 | Full security workflow |

**Example: Import Flow E2E Test**

```typescript
test('complete import workflow', async ({ page }) => {
  // Step 1: Navigate to import wizard
  await page.goto('/import');

  // Step 2: Select entity
  await page.click('text=Users');
  await expect(page).toHaveURL('/import/users');

  // Step 3: Upload file
  await page.setInputFiles('input[type=file]', 'test-data.csv');
  await expect(page.locator('.preview-table')).toBeVisible();

  // Step 4: Review validation
  await expect(page.locator('.valid-rows')).toHaveText('98 valid');
  await expect(page.locator('.invalid-rows')).toHaveText('2 invalid');

  // Step 5: Execute import
  await page.click('text=Import 98 Rows');
  await expect(page.locator('.success-message')).toBeVisible();
  await expect(page.locator('.imported-count')).toHaveText('98');
});
```

---

## The Test Pyramid

We follow the test pyramid for optimal coverage and speed:

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲         56 tests  │ 10 min │ Integration issues
                 ╱──────╲                  │        │ Run before releases
                ╱        ╲                 │        │
               ╱Integration╲     ~50 tests │ 5 min  │ Component interactions
              ╱────────────╲               │        │ Run on PR merge
             ╱              ╲              │        │
            ╱   Unit Tests   ╲   392 tests │ 2 min  │ Individual functions
           ╱──────────────────╲            │        │ Run on every commit
          ╱                    ╲           │        │
         ────────────────────────
```

| Level | Tests | Time | When to Run |
|-------|-------|------|-------------|
| **Unit** | 392 | ~2 min | Every commit, pre-commit hooks |
| **Integration** | ~50 | ~5 min | PR merges, CI/CD |
| **E2E** | 56 | ~10 min | Before releases, nightly builds |

---

## Running Tests

### Quick Commands

```bash
# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific package
npm test --workspace=@dataspec-engine/core
npm test --workspace=@dataspec-engine/react
npm test --workspace=@dataspec-engine/supabase-adapter

# Run E2E tests
cd e2e && npm test

# Run everything
./scripts/test-all.sh
```

### Test Runner Script

Use our comprehensive test runner:

```bash
# Run all tests (unit + E2E)
./scripts/test-all.sh

# Unit tests only (faster)
./scripts/test-all.sh --quick

# E2E tests only
./scripts/test-all.sh --e2e

# Show help
./scripts/test-all.sh --help
```

### Generating Reports

Generate a detailed test report:

```bash
# Generate comprehensive report
./scripts/generate-test-report.sh

# View the report
open docs/test-reports/GENERATED-REPORT.md

# Or in terminal
cat docs/test-reports/GENERATED-REPORT.md
```

---

## Auto-Generated Reports

We auto-generate test reports for different audiences.

### Report Types

| Report | Command | Audience |
|--------|---------|----------|
| **GENERATED-REPORT.md** | `./scripts/generate-test-report.sh` | Technical team |
| **TEST-RESULTS.md** | Manual | Coverage tracking |
| **E2E-TEST-REPORT.md** | Playwright | E2E details |

### What's in the Generated Report

1. **Executive Summary** - Pass/fail at a glance
2. **Package Breakdown** - Per-package statistics
3. **Category Breakdown** - Tests by purpose
4. **Failed Tests** - Full details of failures
5. **Coverage Metrics** - Line, branch, function
6. **Execution Time** - Performance tracking
7. **Recommendations** - Areas to improve

### Running the Report Generator

```bash
./scripts/generate-test-report.sh
```

This script:
1. Runs all tests with JSON output
2. Parses results from each package
3. Calculates coverage metrics
4. Generates markdown report
5. Saves to `docs/test-reports/GENERATED-REPORT.md`

---

## Test Coverage Goals

We maintain strict coverage thresholds:

| Package | Target | Current | Status |
|---------|--------|---------|--------|
| **Core** | 90% | 94.26% | ✅ Exceeds |
| **Supabase Adapter** | 90% | 97.22% | ✅ Exceeds |
| **React** | 80% | ~85% | ✅ Exceeds |
| **API** | 70% | - | 🔄 In Progress |

### Coverage Rules

- PRs **cannot merge** if coverage drops below thresholds
- New features **must include tests**
- Bug fixes **must include regression tests**
- Coverage is checked in CI automatically

---

## Adding New Tests

### Test File Location

```
packages/<package>/src/__tests__/<Component>.test.ts
```

### Test Structure

```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Initialize component
  });

  describe('methodName()', () => {
    it('should do expected thing', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // Edge case test
    });

    it('should throw on invalid input', () => {
      expect(() => component.method(null)).toThrow();
    });
  });
});
```

### What to Test

For any new feature, include:

| Category | Example |
|----------|---------|
| **Happy Path** | Normal expected usage |
| **Edge Cases** | Empty inputs, max values, special chars |
| **Error Cases** | Invalid inputs, network failures |
| **Security Cases** | Unauthorized access, injection attempts |

---

## Troubleshooting

### Tests failing with "module not found"

```bash
npm run build  # Rebuild all packages
```

### Playwright tests failing

```bash
npx playwright install         # Reinstall browsers
npx playwright install chromium  # Specific browser
```

### Port already in use

```bash
lsof -i :3000                # Find process
kill -9 <PID>                # Kill it
```

### Tests timing out

```bash
npx playwright test --timeout=60000  # Increase timeout
```

### React snapshot issues

```bash
npm test --workspace=@dataspec-engine/react -- -u  # Update snapshots
```

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [README](../README.md) | Project overview |
| [Test Results](./TEST-RESULTS.md) | Coverage metrics |
| [Generated Report](./test-reports/GENERATED-REPORT.md) | Auto-generated details |
| [E2E Report](./test-reports/E2E-TEST-REPORT.md) | Playwright results |
| [Screenshots](./test-reports/screenshots/) | Visual test evidence |

---

## The Bottom Line

Every test we write serves one purpose: **preventing production incidents**.

When you're debugging a data corruption issue at 2 AM, you'll wish you had more tests. When a security audit asks "how do you ensure SSNs are always masked?", you'll be glad you can point to 50 masking tests.

**When in doubt, write a test.**
