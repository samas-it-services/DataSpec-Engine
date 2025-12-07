# Case Study: DataSpec Engine Integration with SAMAS Charity Finance

**Document Version:** 1.0
**Date:** December 7, 2025
**Author:** Development Team
**Status:** Implementation Plan Ready

---

## Executive Summary

This case study documents the complete planning and architecture for integrating the **DataSpec Engine** - a YAML-first, API-first data import/export specification engine - into **SAMAS Charity Finance**, a comprehensive financial management system for charitable organizations.

The integration demonstrates how a reusable, enterprise-grade data processing library can be seamlessly embedded into an existing production application while respecting its established design patterns, authentication system, and visual branding.

---

## Table of Contents

1. [Project Background](#1-project-background)
2. [The Challenge](#2-the-challenge)
3. [Solution Architecture](#3-solution-architecture)
4. [Technical Implementation Plan](#4-technical-implementation-plan)
5. [Package Publishing Journey](#5-package-publishing-journey)
6. [Integration Architecture](#6-integration-architecture)
7. [Detailed Phase Breakdown](#7-detailed-phase-breakdown)
8. [File Inventory](#8-file-inventory)
9. [Testing Strategy](#9-testing-strategy)
10. [Lessons Learned](#10-lessons-learned)
11. [Conclusion](#11-conclusion)

---

## 1. Project Background

### 1.1 DataSpec Engine Overview

DataSpec Engine is a YAML-first, API-first, sensitivity-aware import/export framework built for modern Supabase-backed applications. It solves the messy, error-prone, and security-risky challenges of bulk data operations.

**Key Statistics:**
- 4 published packages on GitHub Package Registry
- 516+ unit tests (99% passing)
- 94%+ code coverage
- 56 E2E tests

**Core Packages:**
| Package | Purpose |
|---------|---------|
| `@samas-it-services/dataspec-core` | YAML parser, transformers, masking engine |
| `@samas-it-services/dataspec-supabase-adapter` | Supabase database integration with RLS |
| `@samas-it-services/dataspec-react` | React UI components and hooks |
| `@samas-it-services/dataspec-api` | REST API and Supabase Edge Functions |

### 1.2 SAMAS Charity Finance Overview

SAMAS Charity Finance is a comprehensive financial management platform designed for charitable organizations. Built with modern web technologies, it provides:

- Multi-school financial tracking
- Donor management and receipts
- Grant tracking and reporting
- Budget planning and forecasting
- Governance and compliance tools

**Technology Stack:**
- **Frontend:** React 18, TypeScript, Vite
- **UI Framework:** shadcn/ui components with Tailwind CSS
- **State Management:** React Query (TanStack Query)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Authentication:** Supabase Auth with RBAC
- **Styling:** HSL CSS variables for theming

---

## 2. The Challenge

### 2.1 Business Requirements

SAMAS Charity Finance needed to:

1. **Import bulk data** from legacy systems (CSV/Excel)
2. **Export reports** with automatic sensitive data masking
3. **Maintain audit compliance** for all data operations
4. **Protect donor PII** with role-based data access
5. **Standardize data formats** across multiple entities (transactions, invoices, students, donors)

### 2.2 Technical Requirements

- Integrate without disrupting existing functionality
- Respect the established visual design system
- Work with existing Supabase authentication
- Deploy Edge Functions to existing Supabase project
- Support role-based feature visibility

### 2.3 Constraints

- Must not modify existing database schema beyond adding new tables
- Must use existing role definitions from `user_roles_view`
- Must follow existing routing patterns
- Must maintain dark/light mode compatibility

---

## 3. Solution Architecture

### 3.1 High-Level Integration Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        SAMAS Charity Finance                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Existing Application                             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │  │ Dashboard   │ │ Finance     │ │ Governance  │ │ Reports     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    NEW: DataSpec Section                            │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │  │
│  │  │ Import      │ │ Export      │ │ Masking     │ │ Audit       │  │  │
│  │  │ /dataspec/  │ │ /dataspec/  │ │ /dataspec/  │ │ /dataspec/  │  │  │
│  │  │ import      │ │ export      │ │ masking     │ │ audit       │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                    DataSpecProviderWrapper                               │
│                              │                                           │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │ API Calls
                               v
┌──────────────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ dataspec-    │ │ dataspec-    │ │ dataspec-    │ │ dataspec-    │    │
│  │ entities     │ │ specs        │ │ preview      │ │ masking      │    │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                               │
                               v
┌──────────────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  EXISTING: transactions, invoices, donors, students, user_roles   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  NEW: dataspec_entities, dataspec_definitions, dataspec_logs      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Dedicated `/dataspec/*` routes** | Clean separation from existing features, easier maintenance |
| **Full feature suite** | Import, Export, Masking, Specs, Audit - complete data management |
| **Same Supabase project** | Leverage existing auth, avoid data duplication |
| **Tailwind CSS integration** | Match SAMAS theme via HSL variables |
| **BEM-to-Tailwind mapping** | DataSpec uses BEM classes; map to shadcn styling |

---

## 4. Technical Implementation Plan

### 4.1 Implementation Phases

```
Phase 1: Package Installation & Configuration
    ├── Create .npmrc for GitHub Packages
    ├── Install DataSpec packages
    └── Update Tailwind config

Phase 2: Database Setup
    └── Create DataSpec tables migration with RLS

Phase 3: Edge Functions Deployment
    ├── Copy edge functions from DataSpec
    ├── Modify auth to use SAMAS roles
    └── Deploy to Supabase

Phase 4: CSS/Styling Integration
    ├── Create dataspec.css stylesheet
    └── Map BEM classes to SAMAS theme

Phase 5: Provider & Context Setup
    ├── Create useDataSpecAuth hook
    ├── Create DataSpecProviderWrapper
    └── Integrate into App.tsx

Phase 6: Pages & Routes
    ├── Create 6 DataSpec pages
    └── Add routes to router

Phase 7: Navigation Integration
    └── Add DataSpec section to sidebar

Phase 8: Sample Specifications
    └── Create seed YAML specs for SAMAS entities
```

### 4.2 Dependency Graph

```
┌─────────────────┐
│   Phase 1       │  ← Start here
│   Packages      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    v         v
┌───────┐ ┌───────┐
│Phase 2│ │Phase 4│
│  DB   │ │  CSS  │
└───┬───┘ └───┬───┘
    │         │
    v         │
┌───────┐     │
│Phase 3│     │
│ Edge  │     │
│ Funcs │     │
└───┬───┘     │
    │         │
    └────┬────┘
         │
         v
    ┌─────────┐
    │ Phase 5 │
    │Provider │
    └────┬────┘
         │
         v
    ┌─────────┐
    │ Phase 6 │
    │  Pages  │
    └────┬────┘
         │
    ┌────┴────┐
    v         v
┌───────┐ ┌───────┐
│Phase 7│ │Phase 8│
│ Nav   │ │ Specs │
└───────┘ └───────┘
```

---

## 5. Package Publishing Journey

### 5.1 Initial Challenge: GitHub Package Registry

The DataSpec Engine packages needed to be published to GitHub Package Registry under the `@samas-it-services` organization scope.

**Initial Error:**
```
npm error 403 Permission permission_denied: create_package
```

**Root Cause:** GitHub Package Registry requires the npm scope to match the GitHub organization name exactly.

### 5.2 Resolution Steps

1. **Updated package scope** from `@samas` to `@samas-it-services` in all 4 packages:
   - `packages/core/package.json`
   - `packages/supabase-adapter/package.json`
   - `packages/react/package.json`
   - `packages/api/package.json`

2. **Fixed TypeScript module resolution:**
   ```json
   // packages/supabase-adapter/tsconfig.json
   {
     "compilerOptions": {
       "paths": {
         "@samas-it-services/dataspec-core": ["../core/dist"],
         "@samas-it-services/dataspec-core/*": ["../core/dist/*"]
       }
     }
   }
   ```

3. **Updated `.npmrc` configuration:**
   ```
   @samas-it-services:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

4. **Modified `publish.sh` script** to use correct workspace names

### 5.3 Published Packages

All 4 packages successfully published:

| Package | Version | Registry |
|---------|---------|----------|
| `@samas-it-services/dataspec-core` | 0.1.0 | npm.pkg.github.com |
| `@samas-it-services/dataspec-supabase-adapter` | 0.1.0 | npm.pkg.github.com |
| `@samas-it-services/dataspec-react` | 0.1.0 | npm.pkg.github.com |
| `@samas-it-services/dataspec-api` | 0.1.0 | npm.pkg.github.com |

---

## 6. Integration Architecture

### 6.1 Authentication Integration

DataSpec needs to authenticate with SAMAS's existing Supabase auth system:

```typescript
// src/hooks/useDataSpecAuth.ts
import { useSupabase } from '@/hooks/useSupabase';
import { usePermissions } from '@/hooks/usePermissions';

export function useDataSpecAuth() {
  const { session } = useSupabase();
  const { userRole } = usePermissions();

  return {
    getHeaders: async () => ({
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    }),
    userRoles: [userRole],
    userId: session?.user?.id
  };
}
```

### 6.2 Provider Wrapper Pattern

```typescript
// src/providers/DataSpecProviderWrapper.tsx
import { DataSpecProvider } from '@samas-it-services/dataspec-react';
import { useDataSpecAuth } from '@/hooks/useDataSpecAuth';

export function DataSpecProviderWrapper({ children }) {
  const { getHeaders, userRoles } = useDataSpecAuth();

  const config = {
    api: {
      baseUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`,
      getHeaders
    },
    user: {
      roles: userRoles
    },
    theme: {
      // Map to SAMAS HSL variables
      primaryColor: 'hsl(var(--primary))',
      backgroundColor: 'hsl(var(--background))'
    }
  };

  return (
    <DataSpecProvider config={config}>
      {children}
    </DataSpecProvider>
  );
}
```

### 6.3 CSS Theme Mapping

DataSpec React components use BEM class naming. These must be styled to match SAMAS:

```css
/* src/styles/dataspec.css */

/* Entity Selector */
.dataspec-entity-selector {
  @apply flex flex-col gap-4;
}

.dataspec-entity-selector__grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.dataspec-entity-selector__card {
  @apply p-4 rounded-lg border border-border bg-card
         hover:bg-accent hover:border-primary/50
         transition-colors cursor-pointer;
}

.dataspec-entity-selector__card--selected {
  @apply border-primary bg-primary/5;
}

/* File Upload */
.dataspec-file-upload {
  @apply border-2 border-dashed border-border rounded-lg p-8
         text-center hover:border-primary/50 transition-colors;
}

.dataspec-file-upload--dragging {
  @apply border-primary bg-primary/5;
}

/* Preview Table */
.dataspec-preview-table {
  @apply w-full border-collapse;
}

.dataspec-preview-table th {
  @apply px-4 py-2 text-left font-medium text-muted-foreground
         bg-muted border-b border-border;
}

.dataspec-preview-table td {
  @apply px-4 py-2 border-b border-border;
}

/* Masked Badge */
.dataspec-masked-badge {
  @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
}

.dataspec-masked-badge--public {
  @apply bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400;
}

.dataspec-masked-badge--internal {
  @apply bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400;
}

.dataspec-masked-badge--confidential {
  @apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400;
}

.dataspec-masked-badge--secret {
  @apply bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400;
}

.dataspec-masked-badge--highly-restricted {
  @apply bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400;
}
```

### 6.4 Database Schema Extension

```sql
-- supabase/migrations/20250107000001_dataspec_tables.sql

-- Entity registry for SAMAS
CREATE TABLE dataspec_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  table_name TEXT NOT NULL,
  icon TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- YAML specifications
CREATE TABLE dataspec_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES dataspec_entities(id),
  name TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  yaml_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operation audit log
CREATE TABLE dataspec_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'import', 'export', 'preview'
  entity_id UUID REFERENCES dataspec_entities(id),
  spec_id UUID REFERENCES dataspec_definitions(id),
  user_id UUID REFERENCES auth.users(id),
  rows_processed INTEGER,
  rows_succeeded INTEGER,
  rows_failed INTEGER,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress'
);

-- Unmask audit log (critical for compliance)
CREATE TABLE dataspec_unmask_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_id UUID REFERENCES dataspec_entities(id),
  record_id UUID,
  field_name TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  unmasked_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE dataspec_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_unmask_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read entities
CREATE POLICY "Users can read entities" ON dataspec_entities
  FOR SELECT TO authenticated USING (enabled = true);

-- Only admins can modify specs
CREATE POLICY "Admins can manage specs" ON dataspec_definitions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles_view
      WHERE user_id = auth.uid()
      AND role_name IN ('super_admin', 'admin', 'finance_incharge')
    )
  );

-- Users can read their own logs
CREATE POLICY "Users can read own logs" ON dataspec_operation_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Seed SAMAS entities
INSERT INTO dataspec_entities (name, display_name, description, table_name, icon) VALUES
  ('transactions', 'Transactions', 'Financial transactions', 'transactions', 'receipt'),
  ('invoices', 'Invoices', 'Invoice records', 'invoices', 'file-text'),
  ('donors', 'Donors', 'Donor information', 'donors', 'heart'),
  ('students', 'Students', 'Student records', 'students', 'graduation-cap');
```

---

## 7. Detailed Phase Breakdown

### Phase 1: Package Installation & Configuration

**Objective:** Set up npm to fetch DataSpec packages from GitHub Package Registry

**Files Created:**
- `/samas-charity-finance/.npmrc`

**Files Modified:**
- `/samas-charity-finance/tailwind.config.ts`

**Commands:**
```bash
cd /Users/bilgrami/Documents/code/big-two-projects/samas-charity-finance
npm install @samas-it-services/dataspec-react@^0.1.0 @samas-it-services/dataspec-core@^0.1.0
```

---

### Phase 2: Database Setup

**Objective:** Create DataSpec tables in SAMAS Supabase database

**Files Created:**
- `/supabase/migrations/20250107000001_dataspec_tables.sql`

**Tables Created:**
| Table | Purpose |
|-------|---------|
| `dataspec_entities` | Registry of importable/exportable entities |
| `dataspec_definitions` | YAML specification storage |
| `dataspec_operation_logs` | Audit trail for operations |
| `dataspec_unmask_logs` | Compliance log for sensitive data access |
| `dataspec_versions` | Spec version history |
| `dataspec_security_profiles` | Role-based access mapping |

---

### Phase 3: Edge Functions Deployment

**Objective:** Deploy DataSpec API as Supabase Edge Functions

**Source Files (from DataSpec Engine):**
```
packages/api/supabase-functions/
├── _shared/
│   ├── auth.ts
│   └── cors.ts
├── dataspec-entities/index.ts
├── dataspec-specs/index.ts
├── dataspec-validate/index.ts
├── dataspec-preview/index.ts
└── dataspec-masking/index.ts
```

**Destination:**
```
samas-charity-finance/supabase/functions/
├── _shared/
│   ├── auth.ts  ← Modified for SAMAS roles
│   └── cors.ts
├── dataspec-entities/index.ts
├── dataspec-specs/index.ts
├── dataspec-validate/index.ts
├── dataspec-preview/index.ts
└── dataspec-masking/index.ts
```

**Key Modification - Auth Integration:**
```typescript
// _shared/auth.ts
async function getUserRoles(supabase: SupabaseClient, userId: string) {
  // Query SAMAS's user_roles_view instead of generic roles table
  const { data, error } = await supabase
    .from('user_roles_view')
    .select('role_name')
    .eq('user_id', userId);

  if (error) throw error;
  return data.map(r => r.role_name);
}
```

---

### Phase 4: CSS/Styling Integration

**Objective:** Style DataSpec components to match SAMAS theme

**Files Created:**
- `/src/styles/dataspec.css` (400+ lines of BEM-to-Tailwind mappings)

**Files Modified:**
- `/src/index.css` - Add `@import './styles/dataspec.css';`

**Design Principles:**
- Use `@apply` to map BEM classes to Tailwind utilities
- Reference HSL CSS variables for colors
- Support both light and dark modes
- Match shadcn/ui component aesthetics

---

### Phase 5: Provider & Context Setup

**Objective:** Wire DataSpec provider into SAMAS React tree

**Files Created:**
- `/src/hooks/useDataSpecAuth.ts`
- `/src/providers/DataSpecProviderWrapper.tsx`

**Files Modified:**
- `/src/App.tsx`

**Provider Hierarchy:**
```tsx
<ThemeProvider>
  <QueryClientProvider>
    <AuthProvider>
      <RoleImpersonationProvider>
        <DataSpecProviderWrapper>  {/* NEW */}
          <TooltipProvider>
            <RouterProvider />
          </TooltipProvider>
        </DataSpecProviderWrapper>
      </RoleImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
</ThemeProvider>
```

---

### Phase 6: Pages & Routes

**Objective:** Create DataSpec UI pages integrated into SAMAS

**Files Created:**
```
/src/pages/dataspec/
├── index.tsx      ← Dashboard with stats and feature cards
├── import.tsx     ← Multi-step import wizard
├── export.tsx     ← Export configuration and execution
├── masking.tsx    ← View/unmask sensitive data
├── specs.tsx      ← Browse YAML specifications
└── audit.tsx      ← Operation and unmask logs
```

**Routes Added to App.tsx:**
```tsx
<Route path="/dataspec" element={<MainApp><DataSpecIndex /></MainApp>} />
<Route path="/dataspec/import" element={<MainApp><DataSpecImportPage /></MainApp>} />
<Route path="/dataspec/export" element={<MainApp><DataSpecExportPage /></MainApp>} />
<Route path="/dataspec/masking" element={<MainApp><DataSpecMaskingPage /></MainApp>} />
<Route path="/dataspec/specs" element={<MainApp><DataSpecSpecsPage /></MainApp>} />
<Route path="/dataspec/audit" element={<MainApp><DataSpecAuditPage /></MainApp>} />
```

---

### Phase 7: Navigation Integration

**Objective:** Add DataSpec section to SAMAS sidebar

**Files Modified:**
- `/src/components/layout/Sidebar.tsx`

**Menu Configuration:**
```tsx
{
  id: 'dataspec',
  label: 'DataSpec Engine',
  icon: <Database className="h-5 w-5" />,
  isParent: true,
  color: 'text-teal-700',
  bgColor: 'bg-teal-50',
  borderColor: 'border-teal-200',
  description: 'YAML-driven Import/Export',
  allowedRoles: ['super_admin', 'finance_incharge', 'admin'],
  subItems: [
    { id: 'dataspec-dashboard', label: 'Dashboard', path: '/dataspec' },
    { id: 'dataspec-import', label: 'Import Data', path: '/dataspec/import' },
    { id: 'dataspec-export', label: 'Export Data', path: '/dataspec/export' },
    { id: 'dataspec-masking', label: 'Masking/Unmasking', path: '/dataspec/masking' },
    { id: 'dataspec-specs', label: 'Specifications', path: '/dataspec/specs' },
    { id: 'dataspec-audit', label: 'Audit Logs', path: '/dataspec/audit' }
  ]
}
```

---

### Phase 8: Sample Specifications

**Objective:** Provide ready-to-use YAML specs for SAMAS entities

**Files Created:**
- `/supabase/migrations/20250107000002_dataspec_sample_specs.sql`

**Sample Transaction Import Spec:**
```yaml
entity: transactions
version: "1.0"
description: Import financial transactions from CSV

fields:
  - source: "Transaction Date"
    target: transaction_date
    transform: parse_date
    required: true

  - source: "Amount"
    target: amount
    transform: parse_number
    validation: positive_number

  - source: "Donor Name"
    target: donor_id
    lookup:
      table: donors
      match: full_name
      return: id
      fallback: error

  - source: "Account Number"
    target: account_number
    sensitivity: confidential
    mask: partial

hooks:
  beforeInsert: |
    if (row.amount > 10000) {
      row.requires_approval = true;
    }
```

---

## 8. File Inventory

### Files to Create (19 files)

| File | Phase | Purpose |
|------|-------|---------|
| `.npmrc` | 1 | GitHub Package Registry config |
| `src/styles/dataspec.css` | 4 | Theme mapping stylesheet |
| `src/hooks/useDataSpecAuth.ts` | 5 | Auth header builder |
| `src/providers/DataSpecProviderWrapper.tsx` | 5 | Provider configuration |
| `src/pages/dataspec/index.tsx` | 6 | Dashboard page |
| `src/pages/dataspec/import.tsx` | 6 | Import wizard page |
| `src/pages/dataspec/export.tsx` | 6 | Export page |
| `src/pages/dataspec/masking.tsx` | 6 | Masking management |
| `src/pages/dataspec/specs.tsx` | 6 | Spec browser |
| `src/pages/dataspec/audit.tsx` | 6 | Audit logs viewer |
| `supabase/migrations/20250107000001_dataspec_tables.sql` | 2 | Database schema |
| `supabase/migrations/20250107000002_dataspec_sample_specs.sql` | 8 | Sample YAML specs |
| `supabase/functions/_shared/auth.ts` | 3 | Edge function auth |
| `supabase/functions/_shared/cors.ts` | 3 | CORS handling |
| `supabase/functions/dataspec-entities/index.ts` | 3 | Entity listing API |
| `supabase/functions/dataspec-specs/index.ts` | 3 | Spec CRUD API |
| `supabase/functions/dataspec-validate/index.ts` | 3 | YAML validation API |
| `supabase/functions/dataspec-preview/index.ts` | 3 | Import preview API |
| `supabase/functions/dataspec-masking/index.ts` | 3 | Mask/unmask API |

### Files to Modify (4 files)

| File | Phase | Changes |
|------|-------|---------|
| `tailwind.config.ts` | 1 | Add DataSpec package paths to content |
| `src/index.css` | 4 | Import dataspec.css |
| `src/App.tsx` | 5, 6 | Add provider wrapper and routes |
| `src/components/layout/Sidebar.tsx` | 7 | Add DataSpec navigation |

---

## 9. Testing Strategy

### 9.1 Pre-Integration Checklist

- [ ] GitHub token has `packages:read` scope
- [ ] Supabase CLI installed and authenticated
- [ ] Local Supabase running or remote project accessible
- [ ] SAMAS Charity Finance builds successfully

### 9.2 Phase-by-Phase Testing

| Phase | Test |
|-------|------|
| 1 | `npm ls @samas-it-services/dataspec-react` shows installed |
| 2 | `supabase db push` succeeds, tables visible in dashboard |
| 3 | `curl ${SUPABASE_URL}/functions/v1/dataspec-entities` returns 200 |
| 4 | Components render with correct SAMAS colors in light/dark mode |
| 5 | `useDataSpec()` hook returns entities when provider mounted |
| 6 | Navigate to `/dataspec/*` routes without errors |
| 7 | DataSpec section visible in sidebar for admin users |
| 8 | Sample specs load in spec browser |

### 9.3 End-to-End Testing

| Flow | Steps |
|------|-------|
| **Import Flow** | Select entity → Choose spec → Upload CSV → Preview → Execute |
| **Export Flow** | Select entity → Choose spec → Configure options → Download |
| **Masking Flow** | View masked data → Request unmask → Verify audit log created |
| **Audit Flow** | Navigate to audit → Verify operation logs appear |

### 9.4 Role-Based Access Testing

| Role | Expected Access |
|------|-----------------|
| `super_admin` | Full access to all features |
| `finance_incharge` | Full access to all features |
| `admin` | Full access to all features |
| `teacher` | No access (hidden from sidebar) |
| `accountant` | No access (hidden from sidebar) |

---

## 10. Lessons Learned

### 10.1 Package Publishing

**Learning:** GitHub Package Registry requires exact scope matching with the organization name.

**Best Practice:** Always verify your npm scope matches your GitHub organization before attempting to publish.

### 10.2 TypeScript Module Resolution

**Learning:** When packages reference each other in a monorepo, `tsconfig.json` paths must point to compiled output (`dist/`) during build, but may need different configuration during development.

**Best Practice:** Use project references with `composite: true` and maintain consistent path mappings across `tsconfig.json` and `jest.config.js`.

### 10.3 Component Library Integration

**Learning:** UI libraries using BEM class naming can be styled by consumer applications without modifying the library itself.

**Best Practice:** Design component libraries to emit predictable class names (BEM or similar) and let consumers provide the styles. This maximizes reusability.

### 10.4 Authentication Bridging

**Learning:** Integrating a library that expects its own auth with an existing auth system requires a wrapper/adapter pattern.

**Best Practice:** Create a thin auth hook that translates between your application's auth context and the library's expected interface.

### 10.5 Database Extension Strategy

**Learning:** Adding new tables to an existing Supabase project requires careful consideration of RLS policies and role mapping.

**Best Practice:** Reuse existing role views/tables rather than duplicating role definitions. Reference existing user tables via foreign keys.

---

## 11. Conclusion

This case study documents a complete integration architecture for embedding the DataSpec Engine into SAMAS Charity Finance. The plan demonstrates several key software engineering principles:

1. **Modular Design** - DataSpec was built as reusable packages that can be integrated into any Supabase application
2. **Separation of Concerns** - Clear boundaries between UI, API, and database layers
3. **Theming Flexibility** - BEM class naming allows host applications to provide their own styling
4. **Security by Design** - Role-based access, audit logging, and sensitivity masking are core features
5. **Incremental Delivery** - 8 phases can be implemented and tested independently

### Implementation Status

| Phase | Status |
|-------|--------|
| Phase 1: Package Installation | Ready for implementation |
| Phase 2: Database Setup | Ready for implementation |
| Phase 3: Edge Functions | Ready for implementation |
| Phase 4: CSS/Styling | Ready for implementation |
| Phase 5: Provider Setup | Ready for implementation |
| Phase 6: Pages & Routes | Ready for implementation |
| Phase 7: Navigation | Ready for implementation |
| Phase 8: Sample Specs | Ready for implementation |

### Resources

- **DataSpec Engine Repository:** `/DataSpec-Engine/`
- **SAMAS Charity Finance Repository:** `/samas-charity-finance/`
- **Published Packages:** https://github.com/orgs/samas-it-services/packages
- **Integration Plan:** This document

---

## Appendix A: Sample Page Implementation

```tsx
// src/pages/dataspec/import.tsx
import { useEffect } from 'react';
import {
  EntitySelector,
  SpecSelector,
  FileUpload,
  PreviewTable,
  ImportProgress,
  useDataSpec,
  useImport
} from '@samas-it-services/dataspec-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DataSpecImportPage() {
  const {
    selectedEntity,
    selectedSpec,
    currentStep,
    goToStep
  } = useDataSpec();

  const {
    uploadFile,
    preview,
    executeImport,
    importProgress,
    isImporting
  } = useImport();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Import Data</h1>

      {/* Step 1: Select Entity */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Entity Type</CardTitle>
        </CardHeader>
        <CardContent>
          <EntitySelector mode="cards" />
        </CardContent>
      </Card>

      {/* Step 2: Select Specification */}
      {selectedEntity && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Choose Import Specification</CardTitle>
          </CardHeader>
          <CardContent>
            <SpecSelector entityId={selectedEntity.id} />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Upload File */}
      {selectedSpec && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Upload File</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              accept={['.csv', '.xlsx']}
              onUpload={uploadFile}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Review Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <PreviewTable
              data={preview.rows}
              showMasking={true}
              showValidationErrors={true}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => goToStep('upload')}>
                Back
              </Button>
              <Button onClick={executeImport} disabled={preview.hasErrors}>
                Import {preview.validRowCount} Rows
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Progress */}
      {isImporting && (
        <ImportProgress progress={importProgress} />
      )}
    </div>
  );
}
```

---

## Appendix B: Edge Function Example

```typescript
// supabase/functions/dataspec-preview/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const { user, roles } = await authenticateRequest(req);

    // Parse request body
    const { entityId, specId, fileContent, maxRows = 200 } = await req.json();

    // Create Supabase client with user context
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Fetch spec
    const { data: spec, error: specError } = await supabase
      .from('dataspec_definitions')
      .select('*')
      .eq('id', specId)
      .single();

    if (specError) throw specError;

    // Parse CSV (simplified - use actual parser in production)
    const rows = parseCSV(fileContent).slice(0, maxRows);

    // Apply transformations and masking from spec
    const processedRows = rows.map(row => processRow(row, spec.yaml_content, roles));

    // Return preview result
    return new Response(
      JSON.stringify({
        rows: processedRows,
        totalRows: rows.length,
        validRowCount: processedRows.filter(r => !r.hasErrors).length,
        errorCount: processedRows.filter(r => r.hasErrors).length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

*Document generated as part of the DataSpec Engine project documentation.*
