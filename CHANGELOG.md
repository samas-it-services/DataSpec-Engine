# Changelog

All notable changes to DataSpec Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2025-12-07

### Phase 4 Complete: API Service & Publishing Infrastructure

#### Added - NPM Publishing Infrastructure
- **GitHub Package Registry** - All packages published under `@samas-it-services` scope
- **Automated Publishing Workflow** - `.github/workflows/publish.yml` for CI/CD
- **Manual Publishing Script** - `scripts/publish.sh` with version management
- **Registry Configuration** - `.npmrc` for GitHub Packages authentication

#### Published Packages
| Package | Version | Registry |
|---------|---------|----------|
| `@samas-it-services/dataspec-core` | 0.2.0 | npm.pkg.github.com |
| `@samas-it-services/dataspec-supabase-adapter` | 0.2.0 | npm.pkg.github.com |
| `@samas-it-services/dataspec-react` | 0.2.0 | npm.pkg.github.com |
| `@samas-it-services/dataspec-api` | 0.2.0 | npm.pkg.github.com |

#### Added - SAMAS Integration Case Study
- **Comprehensive Integration Guide** - `docs/CASE-STUDY-SAMAS-INTEGRATION.md`
- **ERR_INSUFFICIENT_RESOURCES Fix** - Documented React Strict Mode compatibility patterns
- **Auth Adapter Pattern** - Recommendations for integrating with existing auth systems
- **Request Management** - Patterns for request deduplication and caching
- **CSS Theme Mapping** - BEM-to-Tailwind styling approach

#### Added - API Package (`@samas-it-services/dataspec-api`)
- **Express REST API** - Full-featured API with 8 endpoints
  - `GET /dataspec/entities` - List available entities
  - `GET /dataspec/specs` - List specs for an entity
  - `POST /dataspec/specs/validate` - Validate YAML spec
  - `POST /dataspec/import/preview` - Preview import
  - `POST /dataspec/import/execute` - Execute full import
  - `POST /dataspec/export` - Export data with masking
  - `POST /dataspec/mask` - Mask field value
  - `POST /dataspec/mask/unmask` - Unmask field value
- **JWT Authentication** - Secure token-based authentication
- **Rate Limiting** - Configurable per-endpoint limits
- **CORS Middleware** - Flexible cross-origin configuration
- **Error Handling** - Standardized error responses
- **Docker Deployment** - Dockerfile + docker-compose.yml

#### Added - Supabase Edge Functions
- `dataspec-entities` - List entities (light operation)
- `dataspec-specs` - List specs (light operation)
- `dataspec-validate` - Validate YAML spec
- `dataspec-preview` - Preview import (<300 rows)
- `dataspec-masking` - Mask/unmask operations
- Shared utilities for CORS and auth

#### Added - Core Services (Framework-Agnostic)
- `EntityService` - Entity CRUD operations
- `SpecService` - Spec management and YAML validation
- `ImportService` - CSV parsing and import execution
- `ExportService` - Data export with masking
- `MaskingService` - Field masking and unmask audit

#### Deployment Options
- **Docker** - Self-hosted container deployment
- **Supabase Edge Functions** - Client-hosted on Supabase
- **Hybrid** - Recommended: light ops on Edge, heavy on Docker

#### Integration Lessons Learned
- React 18 Strict Mode requires careful useEffect dependency management
- Auth objects should not be direct useEffect dependencies (use refs)
- Request deduplication prevents ERR_INSUFFICIENT_RESOURCES errors
- Response caching with TTL reduces API load

---

## [0.1.0] - 2025-12-06

### Phase 3 Complete: React UI Components

#### Added - React Package (`@dataspec-engine/react`)
- **DataSpecProvider** - Central context provider with useReducer state management
- **EntitySelector** - Multi-mode entity selection (dropdown, list, cards)
- **SpecSelector** - Specification selector with filtering
- **FileUpload** - Drag-drop file upload with validation
- **PreviewTable** - Data preview with masking indicators
- **ImportProgress** - Real-time import progress with phases
- **MaskedFieldBadge** - Sensitivity level display component
- **useDataSpec** hook - Workflow management and step tracking
- **useImport** hook - File upload, preview, and import operations
- **useExport** hook - Export with format selection and masking
- 25+ TypeScript interfaces for full type safety
- 76 unit tests (72 passing, 4 skipped)

#### Added - Documentation
- `docs/TEST-RESULTS.md` - Comprehensive test coverage report
- `docs/getting-started.md` - Quick start guide
- `docs/api-reference.md` - Full API documentation
- `docs/yaml-spec-guide.md` - YAML specification format guide
- `packages/react/README.md` - React package documentation
- `packages/core/README.md` - Core package documentation
- `packages/supabase-adapter/README.md` - Adapter documentation
- Updated `README.md` with documentation index
- Updated `architecture.md` with implementation status

---

## [0.0.2] - 2025-12-06

### Phase 2 Complete: Supabase Adapter

#### Added - Supabase Adapter Package (`@dataspec-engine/supabase-adapter`)
- **SupabaseAdapter** - DatabaseAdapter implementation for Supabase
- **RLSValidator** - Row Level Security policy validation
- **AuditLogger** - Comprehensive audit trail logging
- Support for transactions
- Composite key lookups
- 120 unit tests with 97.22% coverage

#### Added - Database Migrations
- `migrations/001_dataspec_tables.sql` - Initial schema

---

## [0.0.1] - 2025-12-05

### Phase 1 Complete: Core Engine

#### Added - Core Package (`@dataspec-engine/core`)
- **YAMLParser** - JSON Schema validated YAML parsing
- **FieldTransformer** - 11 transformation types
  - trim, uppercase, lowercase
  - parse_date, parse_number, parse_boolean
  - round, regex_extract, replace
  - default, concat
- **LookupResolver** - Single and composite key lookups with caching
- **MaskingEngine** - 5 sensitivity levels, 4 masking modes
- **HookExecutor** - 9 extensibility hook points
- **ImportExecutor** - Full import pipeline with preview mode
- **ExportExecutor** - CSV, JSON, Excel export support
- TypeScript types for all interfaces
- 320 unit tests with 94.26% coverage

#### Added - Project Structure
- Turborepo monorepo setup
- npm workspaces configuration
- Jest testing configuration
- TypeScript configuration

---

## Roadmap

### [0.3.0] - Planned
- Integration examples for Firebase, Auth0, NextAuth
- E2E testing with Playwright
- Performance optimizations
- Additional export formats
- Built-in react-query integration for request management

---

## Migration Guide

### From 0.1.0 to 0.2.0

**Package Scope Change**: Packages are now published under `@samas-it-services` scope.

```bash
# Old
npm install @dataspec-engine/core @dataspec-engine/react

# New
npm install @samas-it-services/dataspec-core @samas-it-services/dataspec-react
```

**Update imports**:
```tsx
// Old
import { DataSpecProvider } from '@dataspec-engine/react';

// New
import { DataSpecProvider } from '@samas-it-services/dataspec-react';
```

**GitHub Package Registry Setup**: Add `.npmrc` file:
```
@samas-it-services:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### From 0.0.x to 0.1.0

No breaking changes. React package is a new addition.

To add React components:

```bash
npm install @samas-it-services/dataspec-react
```

```tsx
import { DataSpecProvider, EntitySelector } from '@samas-it-services/dataspec-react';
```

---

## Contributors

- SAMAS IT Services

---

## Links

- [Documentation](./docs/)
- [Architecture](./architecture.md)
- [Test Results](./docs/TEST-RESULTS.md)
- [GitHub Issues](https://github.com/your-org/dataspec-engine/issues)
