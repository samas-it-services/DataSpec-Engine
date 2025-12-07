# DataSpec Engine

**DataSpec Engine** is a YAML-first, API-first, sensitivity-aware import/export framework for Supabase-backed apps.

**Status:** Phase 5 Complete | **Tests:** 396+ (392 passing) | **Packages:** 4 complete

---

## Quick Start

```bash
# Install packages
npm install @dataspec-engine/core @dataspec-engine/react @dataspec-engine/supabase-adapter
```

```tsx
import { DataSpecProvider, EntitySelector, FileUpload, useImport } from '@dataspec-engine/react';

function App() {
  return (
    <DataSpecProvider config={{ api: { baseUrl: 'http://localhost:3000' } }}>
      <ImportWizard />
    </DataSpecProvider>
  );
}
```

See [Getting Started](./docs/getting-started.md) for full setup instructions.

---

## Packages

| Package | Description | Status | Tests |
|---------|-------------|--------|-------|
| [`@dataspec-engine/core`](./packages/core) | YAML parser, transformers, masking, executors | Complete | 320 |
| [`@dataspec-engine/supabase-adapter`](./packages/supabase-adapter) | Supabase database integration | Complete | 120 |
| [`@dataspec-engine/react`](./packages/react) | React UI components and hooks | Complete | 76 |
| [`@dataspec-engine/api`](./packages/api) | REST API (Express + Edge Functions) | Complete | - |

---

## Features

- **YAML-only specs** – human-readable, versionable import/export definitions
- **API-first** – UI never talks to the DB directly; everything is via HTTP APIs
- **Sensitivity & masking** – 5 classification levels with role-based unmasking
- **Schema validation** – JSON Schema-based validation for YAML specs
- **Hooks & extensibility** – 9 hook points for custom logic
- **React UI components** – EntitySelector, FileUpload, PreviewTable, ImportProgress
- **Supabase-native** – metadata + data stored in any Supabase project
- **Cost-effective hosting** – hybrid Edge Functions + Container model

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System design, components, diagrams |
| [Getting Started](./docs/getting-started.md) | Installation and basic usage |
| [API Reference](./docs/api-reference.md) | Component and hook APIs |
| [YAML Spec Guide](./docs/yaml-spec-guide.md) | Specification format |
| [Test Results](./docs/TEST-RESULTS.md) | Coverage and test status |
| [Test Reports](./docs/test-reports/) | E2E, validation & QA certification |
| [Implementation Plan](./docs/IMPLEMENTATION-PLAN.md) | Development progress |

---

## Architecture

```
React App → @dataspec-engine/react
                    ↓
              @dataspec-engine/api
           ┌────────┴────────┐
     Edge Functions      Docker Container
     (light ops)         (heavy ops)
           └────────┬────────┘
              @dataspec-engine/core
                    ↓
              @dataspec-engine/supabase-adapter
                    ↓
              Supabase Postgres
```

See [Architecture](./architecture.md) for detailed diagrams and component descriptions.

---

## Development

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific package tests
npm test --workspace=@dataspec-engine/core
npm test --workspace=@dataspec-engine/react

# Build all packages
npm run build
```

---

## Test Coverage

| Package | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| Core | 94.26% | 83.17% | 96.01% | 94.34% |
| Supabase Adapter | 97.22% | 91.67% | 98.00% | 97.22% |

See [Test Results](./docs/TEST-RESULTS.md) for detailed breakdown.

---

## License

ISC

