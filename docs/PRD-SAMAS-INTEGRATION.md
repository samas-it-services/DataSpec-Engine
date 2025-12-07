# Product Requirements Document (PRD)
# DataSpec Engine Integration with SAMAS Charity Finance

**Version:** 1.0
**Date:** December 7, 2025
**Status:** Ready for Implementation

---

## 1. Executive Summary

### 1.1 Objective
Integrate DataSpec Engine into SAMAS Charity Finance to provide enterprise-grade YAML-driven data import/export with automatic sensitivity classification, masking, and audit logging.

### 1.2 Key Deliverables
- New `/dataspec/*` section in SAMAS application
- 6 new pages: Dashboard, Import, Export, Masking, Specs, Audit
- 5 Supabase Edge Functions for API
- 6 new database tables with RLS policies
- Full theme integration with SAMAS design system

---

## 2. Background

### 2.1 DataSpec Engine
A YAML-first, API-first data import/export framework with:
- **4 Published Packages** on GitHub Package Registry
- **516+ Tests** with 94%+ coverage
- **5 Sensitivity Levels**: Public, Internal, Confidential, Secret, Highly-Restricted
- **Automatic Masking** with role-based unmasking

### 2.2 SAMAS Charity Finance
- React 18 + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- Supabase (PostgreSQL + Auth + Edge Functions)
- Role-based access control via `user_roles_view`

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Import CSV/Excel files with YAML-defined mappings | Must Have |
| FR-2 | Export data with automatic sensitive field masking | Must Have |
| FR-3 | Preview imports before execution | Must Have |
| FR-4 | Role-based unmask with audit logging | Must Have |
| FR-5 | View/manage YAML specifications | Should Have |
| FR-6 | View operation and unmask audit logs | Must Have |

### 3.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | Match SAMAS visual theme (light/dark mode) | Must Have |
| NFR-2 | Use existing Supabase authentication | Must Have |
| NFR-3 | Role visibility: super_admin, finance_incharge, admin only | Must Have |
| NFR-4 | Preview <200 rows in <1 second | Should Have |

---

## 4. Architecture

### 4.1 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 SAMAS Charity Finance                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │              DataSpec Section (/dataspec/*)        │  │
│  │  Dashboard | Import | Export | Masking | Specs | Audit │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│              DataSpecProviderWrapper                     │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Edge Functions                     │
│  dataspec-entities | dataspec-specs | dataspec-preview  │
│  dataspec-validate | dataspec-masking                   │
└──────────────────────────┼──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                         │
│  dataspec_entities | dataspec_definitions               │
│  dataspec_operation_logs | dataspec_unmask_logs         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Package Dependencies

```
@samas-it-services/dataspec-react@0.1.0
@samas-it-services/dataspec-core@0.1.0
```

---

## 5. Implementation Phases

### Phase 1: Package Installation
**Files:**
- CREATE: `.npmrc`
- MODIFY: `tailwind.config.ts`

```bash
npm install @samas-it-services/dataspec-react @samas-it-services/dataspec-core
```

---

### Phase 2: Database Setup
**File:** `supabase/migrations/20250107000001_dataspec_tables.sql`

**Tables:**
| Table | Purpose |
|-------|---------|
| `dataspec_entities` | Entity registry (transactions, invoices, donors, students) |
| `dataspec_definitions` | YAML spec storage |
| `dataspec_operation_logs` | Import/export audit trail |
| `dataspec_unmask_logs` | Sensitive data access log |
| `dataspec_versions` | Spec version history |
| `dataspec_security_profiles` | Role-to-permission mapping |

---

### Phase 3: Edge Functions
**Directory:** `supabase/functions/`

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `dataspec-entities` | GET /entities | List available entities |
| `dataspec-specs` | GET/POST /specs | CRUD for specifications |
| `dataspec-validate` | POST /validate | Validate YAML syntax |
| `dataspec-preview` | POST /preview | Preview import (≤200 rows) |
| `dataspec-masking` | POST /mask, /unmask | Mask/unmask operations |

---

### Phase 4: Styling
**File:** `src/styles/dataspec.css`

Map DataSpec BEM classes to SAMAS Tailwind theme:
- `.dataspec-entity-selector` → Card grid
- `.dataspec-file-upload` → Dropzone
- `.dataspec-preview-table` → Data table
- `.dataspec-masked-badge` → Sensitivity badges (color-coded)

---

### Phase 5: Provider Setup
**Files:**
- CREATE: `src/hooks/useDataSpecAuth.ts`
- CREATE: `src/providers/DataSpecProviderWrapper.tsx`
- MODIFY: `src/App.tsx`

```tsx
// Provider config
{
  api: { baseUrl: `${VITE_SUPABASE_URL}/functions/v1` },
  user: { roles: [userRole] },
  theme: { primaryColor: 'hsl(var(--primary))' }
}
```

---

### Phase 6: Pages
**Directory:** `src/pages/dataspec/`

| Page | Route | Description |
|------|-------|-------------|
| `index.tsx` | `/dataspec` | Dashboard with stats & quick actions |
| `import.tsx` | `/dataspec/import` | 4-step import wizard |
| `export.tsx` | `/dataspec/export` | Export with masking options |
| `masking.tsx` | `/dataspec/masking` | View/unmask sensitive data |
| `specs.tsx` | `/dataspec/specs` | Browse YAML specifications |
| `audit.tsx` | `/dataspec/audit` | Operation & unmask logs |

---

### Phase 7: Navigation
**File:** `src/components/layout/Sidebar.tsx`

```tsx
{
  id: 'dataspec',
  label: 'DataSpec Engine',
  icon: <Database />,
  color: 'text-teal-700',
  bgColor: 'bg-teal-50',
  allowedRoles: ['super_admin', 'finance_incharge', 'admin'],
  subItems: [
    { label: 'Dashboard', path: '/dataspec' },
    { label: 'Import Data', path: '/dataspec/import' },
    { label: 'Export Data', path: '/dataspec/export' },
    { label: 'Masking', path: '/dataspec/masking' },
    { label: 'Specifications', path: '/dataspec/specs' },
    { label: 'Audit Logs', path: '/dataspec/audit' }
  ]
}
```

---

### Phase 8: Sample Specs
**File:** `supabase/migrations/20250107000002_dataspec_sample_specs.sql`

Pre-configured YAML specs for:
- Transactions import/export
- Invoices import/export
- Donors with PII masking
- Students with confidential fields

---

## 6. File Summary

### Files to Create (19)
| Category | Files |
|----------|-------|
| Config | `.npmrc` |
| Styles | `src/styles/dataspec.css` |
| Hooks | `src/hooks/useDataSpecAuth.ts` |
| Providers | `src/providers/DataSpecProviderWrapper.tsx` |
| Pages | `src/pages/dataspec/{index,import,export,masking,specs,audit}.tsx` |
| Migrations | `supabase/migrations/20250107000001_dataspec_tables.sql`, `...000002_dataspec_sample_specs.sql` |
| Edge Functions | `supabase/functions/{_shared/{auth,cors}.ts, dataspec-{entities,specs,validate,preview,masking}/index.ts}` |

### Files to Modify (4)
- `tailwind.config.ts` - Add package content paths
- `src/index.css` - Import dataspec styles
- `src/App.tsx` - Add provider wrapper & routes
- `src/components/layout/Sidebar.tsx` - Add navigation

---

## 7. Testing Checklist

- [ ] Packages install with GITHUB_TOKEN
- [ ] Database migrations succeed
- [ ] Edge functions deploy and respond
- [ ] Theme matches in light/dark mode
- [ ] Navigation visible for admin roles only
- [ ] Import flow: entity → spec → upload → preview → execute
- [ ] Export flow: entity → spec → options → download (masked)
- [ ] Unmask requires role + creates audit log
- [ ] All operations logged

---

## 8. Success Criteria

| Metric | Target |
|--------|--------|
| Import preview latency | <1s for 200 rows |
| Export with masking | 100% sensitive fields masked |
| Audit coverage | 100% of operations logged |
| Role enforcement | 0 unauthorized access |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GitHub token not set | Clear error message with setup instructions |
| Edge function cold start | Use Supabase warm-up or show loading state |
| Large file imports | Limit preview to 200 rows; full import async |

---

## Appendix A: Database Schema

```sql
-- Core tables
CREATE TABLE dataspec_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true
);

CREATE TABLE dataspec_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES dataspec_entities(id),
  name TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  yaml_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dataspec_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  entity_id UUID REFERENCES dataspec_entities(id),
  user_id UUID REFERENCES auth.users(id),
  rows_processed INTEGER,
  status TEXT DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dataspec_unmask_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  field_name TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL,
  reason TEXT,
  unmasked_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE dataspec_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_unmask_logs ENABLE ROW LEVEL SECURITY;
```

---

## Appendix B: Sample YAML Spec

```yaml
entity: transactions
version: "1.0"
fields:
  - source: "Date"
    target: transaction_date
    transform: parse_date
    required: true

  - source: "Amount"
    target: amount
    transform: parse_number
    validation: positive_number

  - source: "Donor"
    target: donor_id
    lookup:
      table: donors
      match: full_name
      return: id

  - source: "Account"
    target: account_number
    sensitivity: confidential
    mask: partial
```

---

*End of PRD*
