# DataSpec Engine — System Architecture

**Last Updated:** 2025-12-06
**Implementation Status:** Phase 3 Complete (React UI)

---

## 1. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Application                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              @dataspec-engine/react                         ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐││
│  │  │DataSpecProvider│ │ Components  │ │      Hooks          │││
│  │  │  (Context)    │ │EntitySelector│ │useDataSpec          │││
│  │  │               │ │SpecSelector │ │useImport             │││
│  │  │               │ │FileUpload   │ │useExport             │││
│  │  │               │ │PreviewTable │ │                      │││
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API-First (HTTPS)
                              v
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │  Supabase Edge Funcs │      │   Lovable Container API      │ │
│  │  (Light Operations)  │      │   (Heavy Operations)         │ │
│  │  - Spec listing      │      │   - Large imports            │ │
│  │  - Validation        │      │   - Hook execution           │ │
│  │  - Small previews    │      │   - Masking/unmasking        │ │
│  └──────────────────────┘      └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────────┐
│                     @dataspec-engine/core                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │YAMLParser  │ │FieldTrans- │ │MaskingEngine│ │ImportExecutor│ │
│  │            │ │former      │ │             │ │ExportExecutor│ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘ │
│  ┌────────────┐ ┌────────────┐                                  │
│  │LookupRes-  │ │HookExecutor│                                  │
│  │olver       │ │            │                                  │
│  └────────────┘ └────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────────┐
│               @dataspec-engine/supabase-adapter                  │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐  │
│  │SupabaseAdapter │ │  RLSValidator  │ │   AuditLogger      │  │
│  │(DatabaseAdapter)│ │                │ │                    │  │
│  └────────────────┘ └────────────────┘ └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Postgres                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  dataspec_definitions │ dataspec_versions │ dataspec_fields │ │
│  │  dataspec_security_profiles │ import_export_logs           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementation Status

| Package | Status | Tests | Coverage |
|---------|--------|-------|----------|
| `@dataspec-engine/core` | Complete | 320 | 94.26% |
| `@dataspec-engine/supabase-adapter` | Complete | 120 | 97.22% |
| `@dataspec-engine/react` | Complete | 76 | - |
| `@dataspec-engine/api` | Not Started | - | - |

**Total Tests:** 516 (512 passing, 4 skipped)

---

## 3. Architectural Principles

- **YAML-First:** All data mappings and transformations defined in YAML
- **API-First:** UI never communicates directly with DB
- **Stateless Engine:** No local state; all metadata stored in Supabase
- **Hybrid Hosting:** Heavy vs light workloads separated for cost efficiency
- **Hook-Based Extensibility:** JS/TS hooks at all stages of execution
- **Sensitivity Enforcement:** Masking/unmasking controlled at API layer

---

## 3. Components

### 3.1 DataSpec Engine Core (Node/TypeScript)

Responsibilities:
- Parse YAML
- Validate via JSON Schema
- Execute transformations and lookups
- Run hooks
- Apply sensitivity masking
- Produce preview/execute results

Key modules:
- parser
- schema
- validators
- hooks registry
- masking engine
- executors

---

## 4. Hosting Architecture

### Supabase Edge Functions
Purpose:
- Spec listing
- YAML schema validation
- Lightweight preview (≤300 rows)

Advantages:
- Very low cost (`$25 free credits` monthly)
- Auto-scaling
- Close to Supabase DB

### Lovable Container API
Purpose:
- Heavy processing → large CSVs, hook logic
- Sensitive operations → masking/unmasking
- Large exports

Advantages:
- Dedicated compute
- Long-running tasks allowed
- Extremely cheap baseline container hosting

---

## 5. Database Schema

Tables:
- dataspec_definitions
- dataspec_versions
- dataspec_fields
- dataspec_security_profiles
- dataspec_user_profiles

Indexes:
- entity
- version
- spec key
- sensitivity level

RLS policies enforce:
- read scopes
- write scopes
- mask/unmask permissions

---

## 6. React UI Architecture

UI modules:
- EntitySelector
- SpecSelector
- FileUpload
- PreviewTable
- ImportExecutor
- MaskedFieldBadge
- SecurityBanner

Support:
- theming
- branding
- API-only interactions

---

## 7. Engine Execution Flow

### Import Preview (light)
1. User uploads CSV
2. UI sends base64 → Edge function
3. Edge function loads YAML spec
4. Runs validation + transform (first 200 rows)
5. Applies masking
6. Returns preview result

### Full Import (heavy)
1. UI sends file to Container API
2. Engine streams CSV
3. Validates rows
4. Runs hooks
5. Writes rows to DB
6. Logs audit trail

---

## 8. Extensibility

Hooks:
```ts
DataSpecEngine.registerHook("validateField:amount", (value, ctx) => {
  if (value < 0) throw new Error("Amount must be positive");
});
````

Custom validators, lookups, transformations, masking logic are supported.

Plugins system planned for the future.

---

## 9. Cost Optimization

* All light workloads on **Supabase Edge Functions**
* Heavy imports only trigger the **Lovable container**
* Lovable includes **$25 free credits** each month
* No need for Kubernetes or server clusters

---

## 10. Security Architecture

* JWT role-based unmasking
* All unmask operations logged
* Spec editing restricted to admins
* RLS protections on all DB tables
* Masking applied by default at API output

---

## 11. Package Structure (Implemented)

```
DataSpec-Engine/
├── packages/
│   ├── core/                         # @dataspec-engine/core
│   │   ├── src/
│   │   │   ├── types/               # TypeScript interfaces
│   │   │   │   ├── spec.types.ts
│   │   │   │   ├── execution.types.ts
│   │   │   │   └── hook.types.ts
│   │   │   ├── parser/
│   │   │   │   ├── YAMLParser.ts
│   │   │   │   └── schema.json
│   │   │   ├── transformers/
│   │   │   │   └── FieldTransformer.ts
│   │   │   ├── lookup/
│   │   │   │   └── LookupResolver.ts
│   │   │   ├── masking/
│   │   │   │   └── MaskingEngine.ts
│   │   │   ├── hooks/
│   │   │   │   └── HookExecutor.ts
│   │   │   ├── executor/
│   │   │   │   ├── ImportExecutor.ts
│   │   │   │   └── ExportExecutor.ts
│   │   │   └── index.ts
│   │   └── __tests__/               # 320 tests
│   │
│   ├── supabase-adapter/            # @dataspec-engine/supabase-adapter
│   │   ├── src/
│   │   │   ├── SupabaseAdapter.ts
│   │   │   ├── RLSValidator.ts
│   │   │   ├── AuditLogger.ts
│   │   │   └── index.ts
│   │   └── __tests__/               # 120 tests
│   │
│   └── react/                       # @dataspec-engine/react
│       ├── src/
│       │   ├── types/index.ts       # 25+ interfaces
│       │   ├── context/
│       │   │   └── DataSpecContext.tsx
│       │   ├── components/
│       │   │   ├── EntitySelector.tsx
│       │   │   ├── SpecSelector.tsx
│       │   │   ├── FileUpload.tsx
│       │   │   ├── PreviewTable.tsx
│       │   │   ├── ImportProgress.tsx
│       │   │   └── MaskedFieldBadge.tsx
│       │   ├── hooks/
│       │   │   ├── useDataSpec.ts
│       │   │   ├── useImport.ts
│       │   │   └── useExport.ts
│       │   └── index.ts
│       └── __tests__/               # 76 tests
│
├── migrations/
│   └── 001_dataspec_tables.sql
│
└── docs/
    ├── IMPLEMENTATION-PLAN.md
    ├── TEST-RESULTS.md
    ├── getting-started.md
    └── api-reference.md
```

---

## 12. Core Engine Components

### YAMLParser
- JSON Schema validation
- YAML to spec object conversion
- Version support

### FieldTransformer
11 transformation types:
- `trim`, `uppercase`, `lowercase`
- `parse_date`, `parse_number`, `parse_boolean`
- `round`, `regex_extract`, `replace`
- `default`, `concat`

### LookupResolver
- Single key lookups
- Composite key lookups
- Caching layer
- Fallback strategies (error, skip, default)

### MaskingEngine
5 sensitivity levels:
- `Public` - No masking
- `Internal` - Partial masking
- `Confidential` - Full masking
- `Secret` - Full masking + audit
- `Highly-Restricted` - Full masking + special permissions

Masking modes: `full`, `partial`, `regex`, `custom`

### HookExecutor
9 hook points:
1. `beforeValidateRow`
2. `validateField`
3. `beforeLookup`
4. `performLookup`
5. `transformField`
6. `maskField`
7. `unmaskField`
8. `beforeInsert`
9. `afterInsert`

---

## 13. React UI Components

### DataSpecProvider
Central context provider managing:
- Entity/spec selection state
- File upload state
- Preview/import progress
- User roles and permissions
- Error handling

### Components

| Component | Description |
|-----------|-------------|
| `EntitySelector` | Multi-mode selection (dropdown, list, cards) |
| `SpecSelector` | Specification selection with filtering |
| `FileUpload` | Drag-drop with validation |
| `PreviewTable` | Data preview with masking indicators |
| `ImportProgress` | Real-time progress with phases |
| `MaskedFieldBadge` | Sensitivity level display |

### Hooks

| Hook | Purpose |
|------|---------|
| `useDataSpec` | Workflow management, step tracking |
| `useImport` | File upload, preview, import execution |
| `useExport` | Export with format/masking options |

---

## 14. Related Documentation

- [Test Results](./docs/TEST-RESULTS.md) - Coverage and test details
- [Implementation Plan](./docs/IMPLEMENTATION-PLAN.md) - Development progress
- [Getting Started](./docs/getting-started.md) - Quick start guide
- [API Reference](./docs/api-reference.md) - Component and hook APIs
