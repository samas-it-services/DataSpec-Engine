# 🏗️ DataSpec Engine Integration Guide

> Step-by-step guide for integrating DataSpec Engine into your application.

---

## 👥 Target Audience

| Audience | Focus Areas |
|----------|-------------|
| 🏗️ **Solution Architects** | System design, deployment options, security |
| 💻 **Senior Developers** | Implementation details, code patterns |
| 🔧 **DevOps Engineers** | Deployment, edge functions, database setup |

---

## 📋 Prerequisites

Before starting integration, ensure you have:

| Requirement | Notes |
|-------------|-------|
| ✅ **Node.js 18+** | Required for TypeScript and React |
| ✅ **Supabase Project** | PostgreSQL database with auth |
| ✅ **GitHub Account** | For accessing @samas-it-services packages |
| ✅ **Supabase CLI** | For edge function deployment |

---

## 🚀 Integration Overview

DataSpec Engine integration follows 8 phases:

```
┌─────────────────┐
│   Phase 1       │  ← Start here
│   Packages      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Phase 2│ │Phase 4│
│  DB   │ │  CSS  │
└───┬───┘ └───┬───┘
    │         │
    ▼         │
┌───────┐     │
│Phase 3│     │
│ Edge  │     │
│ Funcs │     │
└───┬───┘     │
    │         │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Phase 5 │
    │Provider │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ Phase 6 │
    │  Pages  │
    └────┬────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Phase 7│ │Phase 8│
│ Nav   │ │ Specs │
└───────┘ └───────┘
```

---

## 📦 Phase 1: Package Installation

### Step 1.1: Configure NPM for GitHub Packages

Create `.npmrc` in your project root:

```
@samas-it-services:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Step 1.2: Install Packages

```bash
# Install core and React packages
npm install @samas-it-services/dataspec-core@^0.1.0
npm install @samas-it-services/dataspec-react@^0.1.0

# Optional: Supabase adapter (if not using edge functions)
npm install @samas-it-services/dataspec-supabase-adapter@^0.1.0
```

### Step 1.3: Update Tailwind Configuration

Add DataSpec packages to your Tailwind content paths:

```typescript
// tailwind.config.ts
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Add DataSpec packages
    "./node_modules/@samas-it-services/dataspec-react/**/*.{js,ts,jsx,tsx}"
  ],
  // ... rest of config
}
```

---

## 🗄️ Phase 2: Database Setup

### Step 2.1: Create Migration File

Create a new migration file:

```bash
# If using Supabase CLI
supabase migration new dataspec_tables
```

### Step 2.2: Add Schema

```sql
-- dataspec_entities: Registry of importable/exportable entities
CREATE TABLE dataspec_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  table_name TEXT NOT NULL,
  icon TEXT,

  -- Operation mode: full, export_only, view_only, import_only
  operation_mode TEXT DEFAULT 'full'
    CHECK (operation_mode IN ('full', 'export_only', 'view_only', 'import_only')),

  -- Role-based permissions (arrays of role names)
  view_roles TEXT[] DEFAULT ARRAY['super_admin'],
  import_roles TEXT[] DEFAULT ARRAY['super_admin'],
  export_roles TEXT[] DEFAULT ARRAY['super_admin'],

  -- Organization
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- dataspec_definitions: YAML specification storage
CREATE TABLE dataspec_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES dataspec_entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  yaml_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- dataspec_operation_logs: Audit trail for operations
CREATE TABLE dataspec_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
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

-- dataspec_unmask_logs: Compliance log for sensitive data access
CREATE TABLE dataspec_unmask_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_id UUID REFERENCES dataspec_entities(id),
  record_id UUID,
  field_name TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL,
  reason TEXT,
  ip_address INET,
  unmasked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dataspec_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataspec_unmask_logs ENABLE ROW LEVEL SECURITY;
```

### Step 2.3: Add RLS Policies

Customize these policies based on your role system:

```sql
-- Replace 'user_roles_view' with your role view/table
CREATE POLICY "Users can read enabled entities" ON dataspec_entities
  FOR SELECT TO authenticated
  USING (enabled = true);

CREATE POLICY "Admins can manage specs" ON dataspec_definitions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles_view
      WHERE user_id = auth.uid()
      AND role_name IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can read own logs" ON dataspec_operation_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all logs" ON dataspec_operation_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles_view
      WHERE user_id = auth.uid()
      AND role_name IN ('super_admin', 'admin')
    )
  );
```

### Step 2.4: Run Migration

```bash
# Using Supabase CLI
supabase db push

# Or using SQL directly
psql -f migrations/xxxx_dataspec_tables.sql
```

---

## ⚡ Phase 3: Edge Functions

### Step 3.1: Create Function Structure

```
supabase/functions/
├── _shared/
│   ├── auth.ts           # Authentication utilities
│   └── cors.ts           # CORS handling
├── dataspec-entities/
│   └── index.ts          # Entity listing API
├── dataspec-specs/
│   └── index.ts          # Spec CRUD API
├── dataspec-preview/
│   └── index.ts          # Import preview API
├── dataspec-validate/
│   └── index.ts          # YAML validation API
└── dataspec-masking/
    └── index.ts          # Mask/unmask API
```

### Step 3.2: Shared Auth Utility

```typescript
// supabase/functions/_shared/auth.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function authenticateRequest(req: Request): Promise<{
  user: any;
  roles: string[];
  supabase: SupabaseClient;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid token');
  }

  // Fetch user roles from your role view/table
  const { data: roleData } = await supabase
    .from('user_roles_view')  // Replace with your role source
    .select('role_name')
    .eq('user_id', user.id);

  const roles = roleData?.map(r => r.role_name) || [];

  return { user, roles, supabase };
}
```

### Step 3.3: CORS Utility

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
```

### Step 3.4: Entities Endpoint

```typescript
// supabase/functions/dataspec-entities/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user, roles, supabase } = await authenticateRequest(req);

    // Fetch entities the user can view
    const { data: entities, error } = await supabase
      .from('dataspec_entities')
      .select(`
        *,
        spec_count:dataspec_definitions(count)
      `)
      .eq('enabled', true)
      .order('sort_order');

    if (error) throw error;

    // Filter by role permissions
    const filteredEntities = entities.filter(entity => {
      const viewRoles = entity.view_roles || [];
      return viewRoles.some(role => roles.includes(role));
    });

    return new Response(
      JSON.stringify({ entities: filteredEntities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 3.5: Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy dataspec-entities
supabase functions deploy dataspec-specs
supabase functions deploy dataspec-preview
supabase functions deploy dataspec-validate
supabase functions deploy dataspec-masking
```

---

## 🎨 Phase 4: Styling Integration

### Step 4.1: Create DataSpec Stylesheet

```css
/* src/styles/dataspec.css */

/* =============================================================================
   DataSpec Engine - Theme Integration
   Maps BEM classes to your design system
============================================================================= */

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

.dataspec-file-upload__icon {
  @apply w-12 h-12 mx-auto text-muted-foreground mb-4;
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

.dataspec-preview-table tr:hover {
  @apply bg-muted/50;
}

/* Sensitivity Badges */
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

/* Operation Mode Badges */
.dataspec-mode-badge {
  @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium;
}

.dataspec-mode-badge--full {
  @apply bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400;
}

.dataspec-mode-badge--export-only {
  @apply bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400;
}

.dataspec-mode-badge--view-only {
  @apply bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400;
}

.dataspec-mode-badge--import-only {
  @apply bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400;
}

/* Import Progress */
.dataspec-import-progress {
  @apply rounded-lg border border-border p-6;
}

.dataspec-import-progress__bar {
  @apply h-2 rounded-full bg-muted overflow-hidden;
}

.dataspec-import-progress__fill {
  @apply h-full bg-primary transition-all duration-300;
}

/* Validation Errors */
.dataspec-validation-errors {
  @apply rounded-lg border border-destructive/50 bg-destructive/10 p-4;
}

.dataspec-validation-errors__item {
  @apply flex items-start gap-2 text-sm text-destructive;
}
```

### Step 4.2: Import Stylesheet

```css
/* src/index.css */
@import './styles/dataspec.css';
```

---

## ⚙️ Phase 5: Provider Setup

### Step 5.1: Create Auth Hook

```typescript
// src/hooks/useDataSpecAuth.ts
import { useSupabase } from '@/hooks/useSupabase';  // Your Supabase hook
import { usePermissions } from '@/hooks/usePermissions';  // Your permissions hook

export interface DataSpecAuthHeaders {
  Authorization: string;
  'Content-Type': string;
  [key: string]: string;
}

export function useDataSpecAuth() {
  const { session } = useSupabase();
  const { userRole, permissions } = usePermissions();

  const getHeaders = async (): Promise<DataSpecAuthHeaders> => ({
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'Content-Type': 'application/json'
  });

  return {
    getHeaders,
    userRoles: userRole ? [userRole] : [],
    userId: session?.user?.id,
    canImport: permissions?.canImport ?? false,
    canExport: permissions?.canExport ?? false,
    canUnmask: permissions?.canUnmask ?? false,
  };
}
```

### Step 5.2: Create Provider Wrapper

```typescript
// src/providers/DataSpecProviderWrapper.tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useDataSpecAuth } from '@/hooks/useDataSpecAuth';

interface DataSpecContextState {
  entities: EntityDefinition[];
  specs: SpecDefinition[];
  selectedEntity: EntityDefinition | null;
  selectedSpec: SpecDefinition | null;
  isLoading: boolean;
  error: string | null;

  // Permission helpers
  canImportSelected: boolean;
  canExportSelected: boolean;

  // Actions
  loadEntities: () => Promise<void>;
  loadSpecs: (entityId: string) => Promise<void>;
  selectEntity: (entity: EntityDefinition | null) => void;
  selectSpec: (spec: SpecDefinition | null) => void;
}

const DataSpecContext = createContext<DataSpecContextState | null>(null);

export function DataSpecProviderWrapper({ children }: { children: React.ReactNode }) {
  const { getHeaders, userRoles } = useDataSpecAuth();
  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  // State
  const [entities, setEntities] = useState<EntityDefinition[]>([]);
  const [specs, setSpecs] = useState<SpecDefinition[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<EntityDefinition | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<SpecDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request deduplication refs
  const entitiesFetchRef = useRef<Promise<void> | null>(null);
  const specsFetchRef = useRef<Map<string, Promise<void>>>(new Map());

  // Cache refs with TTL
  const entitiesCache = useRef<{ data: EntityDefinition[]; timestamp: number } | null>(null);
  const specsCache = useRef<Map<string, { data: SpecDefinition[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Load entities with caching and deduplication
  const loadEntities = useCallback(async () => {
    // Check cache
    if (entitiesCache.current && Date.now() - entitiesCache.current.timestamp < CACHE_TTL) {
      setEntities(entitiesCache.current.data);
      return;
    }

    // Deduplicate in-flight requests
    if (entitiesFetchRef.current) {
      await entitiesFetchRef.current;
      return;
    }

    const fetchPromise = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const headers = await getHeaders();
        const response = await fetch(`${apiBaseUrl}/dataspec-entities`, { headers });

        if (!response.ok) throw new Error('Failed to load entities');

        const data = await response.json();
        setEntities(data.entities);
        entitiesCache.current = { data: data.entities, timestamp: Date.now() };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        entitiesFetchRef.current = null;
      }
    })();

    entitiesFetchRef.current = fetchPromise;
    await fetchPromise;
  }, [apiBaseUrl, getHeaders]);

  // Load specs for entity with caching
  const loadSpecs = useCallback(async (entityId: string) => {
    // Check cache
    const cached = specsCache.current.get(entityId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setSpecs(cached.data);
      return;
    }

    // Deduplicate
    const existingFetch = specsFetchRef.current.get(entityId);
    if (existingFetch) {
      await existingFetch;
      return;
    }

    const fetchPromise = (async () => {
      setIsLoading(true);

      try {
        const headers = await getHeaders();
        const response = await fetch(
          `${apiBaseUrl}/dataspec-specs?entityId=${entityId}`,
          { headers }
        );

        if (!response.ok) throw new Error('Failed to load specs');

        const data = await response.json();
        setSpecs(data.specs);
        specsCache.current.set(entityId, { data: data.specs, timestamp: Date.now() });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        specsFetchRef.current.delete(entityId);
      }
    })();

    specsFetchRef.current.set(entityId, fetchPromise);
    await fetchPromise;
  }, [apiBaseUrl, getHeaders]);

  // Permission helpers
  const canImportSelected = selectedEntity
    ? selectedEntity.operation_mode !== 'export_only' &&
      selectedEntity.operation_mode !== 'view_only' &&
      (selectedEntity.import_roles || []).some(r => userRoles.includes(r))
    : false;

  const canExportSelected = selectedEntity
    ? selectedEntity.operation_mode !== 'view_only' &&
      selectedEntity.operation_mode !== 'import_only' &&
      (selectedEntity.export_roles || []).some(r => userRoles.includes(r))
    : false;

  return (
    <DataSpecContext.Provider value={{
      entities,
      specs,
      selectedEntity,
      selectedSpec,
      isLoading,
      error,
      canImportSelected,
      canExportSelected,
      loadEntities,
      loadSpecs,
      selectEntity: setSelectedEntity,
      selectSpec: setSelectedSpec,
    }}>
      {children}
    </DataSpecContext.Provider>
  );
}

export function useDataSpec() {
  const context = useContext(DataSpecContext);
  if (!context) {
    throw new Error('useDataSpec must be used within DataSpecProviderWrapper');
  }
  return context;
}
```

### Step 5.3: Add to App

```tsx
// src/App.tsx
import { DataSpecProviderWrapper } from '@/providers/DataSpecProviderWrapper';

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider>
        <AuthProvider>
          <DataSpecProviderWrapper>  {/* Add here */}
            <RouterProvider />
          </DataSpecProviderWrapper>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

---

## 📄 Phase 6: Pages & Routes

### Step 6.1: Create Page Structure

```
src/pages/dataspec/
├── index.tsx      # Dashboard
├── import.tsx     # Import wizard
├── export.tsx     # Export page
├── masking.tsx    # Masking/unmasking
├── specs.tsx      # Specification browser
└── audit.tsx      # Audit logs
```

### Step 6.2: Example Import Page

```tsx
// src/pages/dataspec/import.tsx
import { useEffect, useState } from 'react';
import { useDataSpec } from '@/providers/DataSpecProviderWrapper';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DataSpecImportPage() {
  const {
    entities,
    specs,
    selectedEntity,
    selectedSpec,
    isLoading,
    error,
    canImportSelected,
    loadEntities,
    loadSpecs,
    selectEntity,
    selectSpec,
  } = useDataSpec();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (selectedEntity) {
      loadSpecs(selectedEntity.id);
    }
  }, [selectedEntity, loadSpecs]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">📥 Import Data</h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Select Entity */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Entity Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {entities
              .filter(e => e.operation_mode !== 'export_only' && e.operation_mode !== 'view_only')
              .map(entity => (
                <div
                  key={entity.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors
                    ${selectedEntity?.id === entity.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'}`}
                  onClick={() => selectEntity(entity)}
                >
                  <div className="font-medium">{entity.display_name}</div>
                  <div className="text-sm text-muted-foreground">{entity.description}</div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Select Spec */}
      {selectedEntity && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Choose Import Specification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {specs.map(spec => (
                <div
                  key={spec.id}
                  className={`p-3 rounded border cursor-pointer
                    ${selectedSpec?.id === spec.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'}`}
                  onClick={() => selectSpec(spec)}
                >
                  <div className="font-medium">{spec.name}</div>
                  <div className="text-sm text-muted-foreground">v{spec.version}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: File Upload */}
      {selectedSpec && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Upload File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {file ? (
                  <div className="text-primary font-medium">{file.name}</div>
                ) : (
                  <div className="text-muted-foreground">
                    Click to upload CSV or Excel file
                  </div>
                )}
              </label>
            </div>

            {file && !canImportSelected && (
              <Alert className="mt-4">
                <AlertDescription>
                  You don't have permission to import to this entity.
                </AlertDescription>
              </Alert>
            )}

            {file && canImportSelected && (
              <Button className="mt-4" onClick={() => {/* Preview logic */}}>
                Preview Import
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Step 6.3: Add Routes

```tsx
// src/App.tsx or router config
<Route path="/dataspec" element={<DataSpecDashboard />} />
<Route path="/dataspec/import" element={<DataSpecImportPage />} />
<Route path="/dataspec/export" element={<DataSpecExportPage />} />
<Route path="/dataspec/masking" element={<DataSpecMaskingPage />} />
<Route path="/dataspec/specs" element={<DataSpecSpecsPage />} />
<Route path="/dataspec/audit" element={<DataSpecAuditPage />} />
```

---

## 🧭 Phase 7: Navigation

### Step 7.1: Add Sidebar Section

```tsx
// In your sidebar configuration
const menuItems = [
  // ... existing items
  {
    id: 'dataspec',
    label: 'DataSpec Engine',
    icon: <Database className="h-5 w-5" />,
    isParent: true,
    color: 'text-teal-700',
    allowedRoles: ['super_admin', 'admin', 'finance_incharge'],
    subItems: [
      { id: 'dataspec-dashboard', label: 'Dashboard', path: '/dataspec', icon: '📊' },
      { id: 'dataspec-import', label: 'Import Data', path: '/dataspec/import', icon: '📥' },
      { id: 'dataspec-export', label: 'Export Data', path: '/dataspec/export', icon: '📤' },
      { id: 'dataspec-masking', label: 'Masking', path: '/dataspec/masking', icon: '🔒' },
      { id: 'dataspec-specs', label: 'Specifications', path: '/dataspec/specs', icon: '📋' },
      { id: 'dataspec-audit', label: 'Audit Logs', path: '/dataspec/audit', icon: '📜' }
    ]
  }
];
```

---

## 📝 Phase 8: Sample Specifications

### Step 8.1: Create Sample Entity

```sql
-- Insert a sample entity
INSERT INTO dataspec_entities (
  name, display_name, description, table_name,
  operation_mode, view_roles, import_roles, export_roles,
  category
) VALUES (
  'users',
  'User Accounts',
  'Import/export user account data',
  'users',
  'full',
  ARRAY['super_admin', 'admin'],
  ARRAY['super_admin'],
  ARRAY['super_admin', 'admin'],
  'system'
);
```

### Step 8.2: Create Sample Spec

```sql
-- Insert a sample YAML spec
INSERT INTO dataspec_definitions (
  entity_id,
  name,
  version,
  yaml_content
) VALUES (
  (SELECT id FROM dataspec_entities WHERE name = 'users'),
  'users_standard_v1',
  '1.0.0',
  '
# =============================================================================
# DataSpec: User Accounts Standard Import/Export
# =============================================================================
metadata:
  name: users_standard_v1
  entity: users
  version: "1.0.0"
  description: Standard user account import/export

  permissions:
    viewRoles: [super_admin, admin]
    importRoles: [super_admin]
    exportRoles: [super_admin, admin]

options:
  skipEmptyRows: true
  trimWhitespace: true

columns:
  - source: "Email"
    target: email
    type: string
    required: true
    sensitivity: confidential
    validation:
      - type: email

  - source: "Full Name"
    target: full_name
    type: string
    required: true
    sensitivity: internal

  - source: "Role"
    target: role
    type: string
    required: true
    sensitivity: internal
    validation:
      - type: enum
        values: [admin, user, viewer]
'
);
```

---

## ✅ Verification Checklist

### Phase Completion Checks

| Phase | Verification |
|-------|--------------|
| ✅ Phase 1 | `npm ls @samas-it-services/dataspec-core` shows installed |
| ✅ Phase 2 | Tables visible in Supabase dashboard |
| ✅ Phase 3 | `curl $SUPABASE_URL/functions/v1/dataspec-entities` returns 200 |
| ✅ Phase 4 | Components render with correct theme colors |
| ✅ Phase 5 | `useDataSpec()` returns entities when provider mounted |
| ✅ Phase 6 | Navigate to `/dataspec/*` routes without errors |
| ✅ Phase 7 | DataSpec section visible in sidebar |
| ✅ Phase 8 | Sample specs load in spec browser |

### End-to-End Tests

| Flow | Steps |
|------|-------|
| **Import** | Select entity → Choose spec → Upload CSV → Preview → Execute |
| **Export** | Select entity → Choose spec → Configure → Download |
| **Masking** | View masked data → Request unmask → Verify audit log |

---

## 📚 Related Documentation

- [Operation Modes Guide](./operation-modes.md) - Configure entity restrictions
- [Role Permissions Guide](./role-permissions.md) - Set up role-based access
- [YAML Spec Guide](./yaml-spec-guide.md) - Complete specification reference
- [API Reference](./api-reference.md) - Full API documentation
- [saMas Case Study](./case-studies/samas-charity-finance.md) - Production example

---

**Need help?** Review the [saMas Case Study](./case-studies/samas-charity-finance.md) for a complete production integration example.
