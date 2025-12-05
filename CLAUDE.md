# DataSpec Engine — Product Requirements Document (PRD)

## 1. Overview

DataSpec Engine is a YAML-first, API-first data import/export specification engine built for Supabase Postgres applications. It provides mapping, validation, transformation, lookup, and sensitivity-classification logic for CSV/Excel ingestion across multiple entities (students, parents, schools, bank accounts, vendors, transactions, etc.).

The engine runs as:

- A **Lovable-hosted containerized API service** (heavy processing)
- **Supabase Edge Functions** (lightweight preview + validation)
- A reusable **React UI module** (fully API-driven)

---

## 2. Goals

### Primary Goals
- Create an enterprise-grade YAML specification format for mapping CSV → DB entities
- Support column-level sensitivity classification (Public, Internal, Confidential, Secret, Highly-Restricted)
- Implement masking/unmasking logic with role enforcement
- Provide developer extensibility via JavaScript hooks
- Provide a UI module to select entity + spec and upload files
- Support round-trip import/export with transformations
- Ensure the module is reusable across projects

### Secondary Goals
- Minimize hosting costs using a hybrid deployment model
- Provide a schema-validated, strongly typed YAML structure
- Export/import YAML specs to/from DB
- Allow versioning of specs

---

## 3. YAML Spec Requirements

Each YAML spec must include:

- Entity metadata
- Column mappings
- Lookup rules (single key, composite key)
- Defaulting & fallback strategies
- Regex extraction logic
- Validation rules
- Sensitivity classification per field
- Mask/unmask policies
- Hook execution points:
  - beforeValidateRow
  - validateField
  - beforeLookup
  - performLookup
  - transformField
  - maskField
  - unmaskField
  - beforeInsert
  - afterInsert

---

## 4. API Requirements (API-First Only)

Endpoints include:

```

GET  /dataspec/entities
GET  /dataspec/specs
POST /dataspec/specs/validate-yaml
POST /dataspec/import/preview
POST /dataspec/import/execute
POST /dataspec/export
POST /dataspec/mask
POST /dataspec/unmask

````

Frontend has **no direct DB access**.

---

## 5. Sensitivity & Masking Rules

Supported levels:
- Public
- Internal
- Confidential
- Secret
- Highly-Restricted

Supported masking styles:
- full
- partial
- regex
- custom JS hook

Unmasking requires:
- Valid JWT role
- API-level permission check
- Logged event

---

## 6. Execution Modes

- **Preview mode**: validate + transform in memory, no writes
- **Execute mode**: full DB write via abstraction layer
- **Export mode**: apply masking rules automatically

---

## 7. Backend Requirements

Database tables (Supabase):

- dataspec_definitions
- dataspec_versions
- dataspec_fields
- dataspec_security_profiles
- dataspec_hooks

Engine uses a pluggable DB adapter:

```ts
interface DatabaseAdapter {
  find(table, query)
  lookup(table, key)
  insert(table, rows)
  update(table, rows)
}
````

---

## 8. React UI Requirements

Themeable + brandable:

```tsx
<DataSpecUIProvider
  apiBaseUrl="..."
  theme={{ primaryColor: "#00aaff" }}
  branding={{ logoUrl: "/logo.svg" }}
>
```

Components:

* EntitySelector
* SpecSelector
* YAMLViewer
* FileUpload
* PreviewTable
* ValidationErrorsPanel

---

## 9. Deployment Requirements

Hybrid hosting:

### Supabase Edge Functions (light)

* YAML validation
* Spec listing
* Sample previews (<300 rows)

### Lovable Container (heavy)

* Full CSV parsing
* Hook execution
* Masking/unmasking
* Exporting large datasets

Lovable provides **$25 free monthly credits** and pay-as-you-go pricing.

---

## 10. Success Metrics

* > 80% reuse of specs across projects
* Zero unmasked exposure without proper permissions
* Full preview in <1 second for 200 rows
* Import 10k rows in <30 seconds
