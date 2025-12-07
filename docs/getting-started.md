# Getting Started with DataSpec Engine

This guide will help you set up and use DataSpec Engine in your Supabase-backed React application.

## Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase project (for database)
- React 18+

## Installation

### 1. Install Packages

```bash
# Core engine (required)
npm install @dataspec-engine/core

# React UI components (for frontend)
npm install @dataspec-engine/react

# Supabase adapter (for database integration)
npm install @dataspec-engine/supabase-adapter
```

### 2. Set Up Database Tables

Run the migration in your Supabase project:

```sql
-- migrations/001_dataspec_tables.sql
CREATE TABLE dataspec_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  entity VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  yaml_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(entity, version)
);

CREATE TABLE dataspec_security_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID REFERENCES dataspec_definitions(id),
  field_name VARCHAR(255) NOT NULL,
  sensitivity_level VARCHAR(50) NOT NULL,
  mask_mode VARCHAR(50) DEFAULT 'full',
  unmask_roles TEXT[] DEFAULT '{}',
  UNIQUE(spec_id, field_name)
);

CREATE TABLE import_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID REFERENCES dataspec_definitions(id),
  operation VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_rows INTEGER,
  successful_rows INTEGER,
  failed_rows INTEGER,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

## Basic Usage

### React Application Setup

```tsx
// App.tsx
import { DataSpecProvider } from '@dataspec-engine/react';

function App() {
  return (
    <DataSpecProvider
      config={{
        api: {
          baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
        },
      }}
      userRoles={['admin']} // User's roles for permission checking
    >
      <YourApp />
    </DataSpecProvider>
  );
}
```

### Import Workflow

```tsx
// ImportPage.tsx
import {
  EntitySelector,
  SpecSelector,
  FileUpload,
  PreviewTable,
  ImportProgress,
  useImport,
} from '@dataspec-engine/react';

function ImportPage() {
  const {
    preview,
    importProgress,
    isReady,
    startImport,
  } = useImport({
    autoPreview: true,
    onImportComplete: (result) => {
      console.log(`Imported ${result.successfulRows} rows`);
    },
  });

  return (
    <div className="import-wizard">
      <h1>Data Import</h1>

      {/* Step 1: Select Entity */}
      <section>
        <h2>1. Select Entity</h2>
        <EntitySelector mode="cards" autoLoad />
      </section>

      {/* Step 2: Select Specification */}
      <section>
        <h2>2. Select Import Spec</h2>
        <SpecSelector autoLoad />
      </section>

      {/* Step 3: Upload File */}
      <section>
        <h2>3. Upload File</h2>
        <FileUpload
          acceptedTypes={['.csv', '.xlsx']}
          maxSize={10 * 1024 * 1024}
        />
      </section>

      {/* Step 4: Preview */}
      {preview && (
        <section>
          <h2>4. Preview</h2>
          <PreviewTable showMaskedIndicators />
        </section>
      )}

      {/* Step 5: Import */}
      <section>
        <button
          onClick={startImport}
          disabled={!isReady.forImport}
        >
          Start Import
        </button>
        <ImportProgress showErrors />
      </section>
    </div>
  );
}
```

### Export Workflow

```tsx
// ExportPage.tsx
import { useExport } from '@dataspec-engine/react';

function ExportPage() {
  const {
    isReady,
    isExporting,
    exportAsCsv,
    exportAsExcel,
    setFormat,
    toggleMasking,
    options,
  } = useExport({
    defaultFormat: 'csv',
    defaultApplyMasking: true,
    autoDownload: true,
  });

  return (
    <div className="export-page">
      <h1>Data Export</h1>

      <div className="options">
        <label>
          <input
            type="checkbox"
            checked={options.applyMasking}
            onChange={toggleMasking}
          />
          Apply data masking
        </label>
      </div>

      <div className="actions">
        <button onClick={exportAsCsv} disabled={!isReady || isExporting}>
          Export as CSV
        </button>
        <button onClick={exportAsExcel} disabled={!isReady || isExporting}>
          Export as Excel
        </button>
      </div>
    </div>
  );
}
```

## YAML Specification Example

Create a spec for importing transaction data:

```yaml
# transactions-import.yaml
version: "1.0"
metadata:
  name: "transactions-import"
  description: "Import transaction data"
  entity: "transactions"

database:
  table: "transactions"
  primary_key: "id"

columns:
  - name: "id"
    source: "Transaction ID"
    type: "uuid"
    required: true

  - name: "amount"
    source: "Amount"
    type: "decimal"
    required: true
    sensitivity: "confidential"
    transform:
      - type: "round"
        decimals: 2

  - name: "description"
    source: "Description"
    type: "text"
    transform:
      - type: "trim"

  - name: "date"
    source: "Transaction Date"
    type: "date"
    transform:
      - type: "parse_date"
        format: "YYYY-MM-DD"

import_options:
  duplicate_strategy: "skip"
  batch_size: 100
```

## Core Engine Usage (Backend)

```typescript
// server/import-handler.ts
import { YAMLParser, ImportExecutor } from '@dataspec-engine/core';
import { SupabaseAdapter } from '@dataspec-engine/supabase-adapter';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function handleImport(yamlContent: string, csvData: string) {
  // Parse YAML specification
  const parser = new YAMLParser();
  const spec = parser.parse(yamlContent);

  // Create database adapter
  const adapter = new SupabaseAdapter(supabase);

  // Execute import
  const executor = new ImportExecutor(spec, adapter);
  const result = await executor.execute(csvData, {
    mode: 'execute',
    batchSize: 100,
  });

  return result;
}
```

## User Roles and Permissions

Configure user roles for masking/unmasking:

```tsx
// Get roles from your auth system
const userRoles = ['admin', 'data_manager'];

<DataSpecProvider
  config={{ api: { baseUrl: '...' } }}
  userRoles={userRoles}
>
  {/* Components can now check canUnmask */}
</DataSpecProvider>
```

Roles that can unmask by default:
- `admin`
- `super_admin`
- `data_manager`

## Next Steps

- [API Reference](./api-reference.md) - Full component and hook documentation
- [YAML Spec Guide](./yaml-spec-guide.md) - Complete specification format
- [Architecture](../architecture.md) - System design overview
- [Test Results](./TEST-RESULTS.md) - Test coverage details

## Troubleshooting

### Memory Issues with Tests

If you encounter heap memory errors:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

### CORS Issues

Ensure your API allows requests from your frontend origin:

```typescript
// api/middleware/cors.ts
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
```

### Missing Entity/Spec

Verify your API endpoints return the expected format:

```typescript
// GET /dataspec/entities
[
  { id: '1', name: 'Transactions', table: 'transactions', specCount: 3 }
]

// GET /dataspec/specs?entity=1
[
  { id: '1', name: 'Default Import', entity: '1', version: '1.0', ... }
]
```
