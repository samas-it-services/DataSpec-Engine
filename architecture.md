# DataSpec Engine — System Architecture

## 1. High-Level System Diagram

````

React UI (Lovable)
|
| API-First (HTTPS)
v
┌──────────────────────────────┐
│      API Router (optional)   │
└──────────────┬───────────────┘
|
┌─────────┼─────────┐
|                   |
v                   v
┌────────────┐    ┌──────────────────────┐
│ Supabase   │    │  Lovable Container   │
│ Edge Funcs │    │  (DataSpec API)      │
└────────────┘    └──────────────────────┘
\             /
\           /
\         /
v       v
┌────────────────────────┐
│      Supabase DB       │
│  (metadata + entities) │
└────────────────────────┘

````

---

## 2. Architectural Principles

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
