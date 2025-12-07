# @dataspec-engine/react

React UI components for DataSpec Engine - a YAML-first, API-first data import/export framework.

## Installation

```bash
npm install @dataspec-engine/react
```

### Peer Dependencies

```bash
npm install react react-dom @dataspec-engine/core
```

## Quick Start

```tsx
import { DataSpecProvider, EntitySelector, FileUpload, useImport } from '@dataspec-engine/react';

function App() {
  return (
    <DataSpecProvider
      config={{ api: { baseUrl: 'http://localhost:3000' } }}
      userRoles={['admin']}
    >
      <ImportWizard />
    </DataSpecProvider>
  );
}

function ImportWizard() {
  const { file, preview, startImport, isReady } = useImport({
    autoPreview: true,
    onImportComplete: (result) => console.log('Import complete:', result),
  });

  return (
    <div>
      <EntitySelector mode="cards" autoLoad />
      <FileUpload acceptedTypes={['.csv', '.xlsx']} maxSize={10 * 1024 * 1024} />
      <button onClick={startImport} disabled={!isReady.forImport}>
        Start Import
      </button>
    </div>
  );
}
```

## Components

### DataSpecProvider

Central context provider that manages all state for DataSpec operations.

```tsx
<DataSpecProvider
  config={{
    api: {
      baseUrl: 'http://localhost:3000',
      headers: { 'Authorization': 'Bearer token' }
    }
  }}
  userRoles={['admin', 'data_manager']}
>
  {children}
</DataSpecProvider>
```

### EntitySelector

Multi-mode entity selection component.

```tsx
// Dropdown mode
<EntitySelector
  mode="dropdown"
  autoLoad
  onSelect={(entity) => console.log(entity)}
/>

// List mode
<EntitySelector mode="list" autoLoad showDescription />

// Cards mode
<EntitySelector mode="cards" autoLoad showSpecCount />
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'dropdown' \| 'list' \| 'cards'` | `'dropdown'` | Display mode |
| `autoLoad` | `boolean` | `false` | Load entities on mount |
| `onSelect` | `(entity) => void` | - | Selection callback |
| `showDescription` | `boolean` | `false` | Show entity descriptions |
| `showSpecCount` | `boolean` | `false` | Show spec counts |
| `disabled` | `boolean` | `false` | Disable selection |

### SpecSelector

Specification selector with filtering.

```tsx
<SpecSelector
  autoLoad
  onSelect={(spec) => console.log(spec)}
  showVersion
/>
```

### FileUpload

Drag-and-drop file upload with validation.

```tsx
<FileUpload
  acceptedTypes={['.csv', '.xlsx', '.xls']}
  maxSize={10 * 1024 * 1024}
  onFileSelect={(file) => console.log(file)}
  onError={(error) => console.error(error)}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `acceptedTypes` | `string[]` | `['.csv']` | Accepted file extensions |
| `maxSize` | `number` | `5MB` | Max file size in bytes |
| `onFileSelect` | `(file) => void` | - | File selection callback |
| `onError` | `(error) => void` | - | Error callback |
| `disabled` | `boolean` | `false` | Disable upload |

### PreviewTable

Data preview with masking indicators.

```tsx
<PreviewTable
  showMaskedIndicators
  onUnmask={(row, field) => handleUnmask(row, field)}
/>
```

### ImportProgress

Real-time import progress display.

```tsx
<ImportProgress
  showErrors
  onCancel={() => handleCancel()}
/>
```

### MaskedFieldBadge

Display sensitivity level for masked fields.

```tsx
<MaskedFieldBadge
  sensitivity="confidential"
  canUnmask={userCanUnmask}
  onUnmask={() => handleUnmask()}
/>
```

## Hooks

### useDataSpec

Main hook for workflow management.

```tsx
const {
  // State
  entities,
  specs,
  selectedEntity,
  selectedSpec,

  // Derived state
  currentStep,      // 'select-entity' | 'select-spec' | 'upload' | 'preview' | 'import'
  canPreview,
  canImport,
  isImporting,

  // Actions
  selectEntity,
  selectSpec,
  startNewWorkflow,
  reset,
} = useDataSpec();
```

### useImport

Hook for import operations.

```tsx
const {
  // State
  file,
  fileName,
  preview,
  importProgress,
  importResult,
  error,

  // Derived state
  isReady: { forUpload, forPreview, forImport },
  phaseDescription,
  progressPercent,

  // Actions
  setFile,
  clearFile,
  uploadFile,
  generatePreview,
  startImport,
  cancelImport,
  reset,
} = useImport({
  autoPreview: true,
  onPreviewReady: (preview) => {},
  onImportComplete: (result) => {},
  onError: (error) => {},
});
```

### useExport

Hook for export operations.

```tsx
const {
  // State
  entity,
  spec,
  options,
  lastExport,
  error,
  canUnmask,

  // Derived state
  isReady,
  isExporting,

  // Actions
  setFormat,         // 'csv' | 'json' | 'xlsx'
  toggleMasking,
  setFilters,
  setFields,
  startExport,
  exportAsCsv,
  exportAsJson,
  exportAsExcel,
  exportUnmasked,   // Requires permission
  reset,
} = useExport({
  defaultFormat: 'csv',
  defaultApplyMasking: true,
  autoDownload: true,
  onExportComplete: (result) => {},
  onError: (error) => {},
});
```

## Types

Key TypeScript interfaces:

```typescript
interface DataSpecProviderConfig {
  api: {
    baseUrl: string;
    headers?: Record<string, string>;
  };
}

interface EntityDefinition {
  id: string;
  name: string;
  description?: string;
  table: string;
  specCount?: number;
}

interface SpecDefinition {
  id: string;
  name: string;
  entity: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

enum SensitivityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  HIGHLY_RESTRICTED = 'highly_restricted',
}

enum OperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  ERROR = 'error',
}
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

**Test Results:**
- 76 total tests
- 72 passing
- 4 skipped (async timing issues)

## Related Packages

- [@dataspec-engine/core](../core/README.md) - Core engine
- [@dataspec-engine/supabase-adapter](../supabase-adapter/README.md) - Supabase integration

## Documentation

- [Architecture](../../architecture.md) - System design
- [Getting Started](../../docs/getting-started.md) - Quick start guide
- [API Reference](../../docs/api-reference.md) - Full API documentation
- [Test Results](../../docs/TEST-RESULTS.md) - Coverage report

## License

ISC
