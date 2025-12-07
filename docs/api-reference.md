# DataSpec Engine - API Reference

Complete API documentation for all DataSpec Engine packages.

---

## Table of Contents

- [React Components](#react-components)
- [React Hooks](#react-hooks)
- [Core Engine](#core-engine)
- [Supabase Adapter](#supabase-adapter)
- [TypeScript Types](#typescript-types)

---

## React Components

### DataSpecProvider

Context provider for all DataSpec operations.

```tsx
<DataSpecProvider
  config={DataSpecProviderConfig}
  userRoles={string[]}
>
  {children}
</DataSpecProvider>
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `DataSpecProviderConfig` | Yes | API configuration |
| `userRoles` | `string[]` | No | User's roles for permissions |
| `children` | `ReactNode` | Yes | Child components |

### EntitySelector

Multi-mode entity selection component.

```tsx
<EntitySelector
  mode="dropdown" | "list" | "cards"
  autoLoad={boolean}
  onSelect={(entity: EntityDefinition) => void}
  placeholder={string}
  showDescription={boolean}
  showSpecCount={boolean}
  disabled={boolean}
  className={string}
  renderEntity={(entity, isSelected) => ReactNode}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'dropdown' \| 'list' \| 'cards'` | `'dropdown'` | Display mode |
| `autoLoad` | `boolean` | `false` | Load entities on mount |
| `onSelect` | `(entity) => void` | - | Selection callback |
| `placeholder` | `string` | `'Select entity'` | Placeholder text |
| `showDescription` | `boolean` | `false` | Show descriptions |
| `showSpecCount` | `boolean` | `false` | Show spec counts |
| `disabled` | `boolean` | `false` | Disable component |
| `className` | `string` | - | Custom CSS class |
| `renderEntity` | `function` | - | Custom render function |

### SpecSelector

Specification selector with filtering.

```tsx
<SpecSelector
  autoLoad={boolean}
  onSelect={(spec: SpecDefinition) => void}
  placeholder={string}
  showVersion={boolean}
  disabled={boolean}
  className={string}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoLoad` | `boolean` | `false` | Load specs on entity change |
| `onSelect` | `(spec) => void` | - | Selection callback |
| `placeholder` | `string` | `'Select spec'` | Placeholder text |
| `showVersion` | `boolean` | `true` | Show version numbers |
| `disabled` | `boolean` | `false` | Disable component |

### FileUpload

Drag-and-drop file upload component.

```tsx
<FileUpload
  acceptedTypes={string[]}
  maxSize={number}
  onFileSelect={(file: File) => void}
  onError={(error: string) => void}
  disabled={boolean}
  className={string}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `acceptedTypes` | `string[]` | `['.csv']` | Accepted extensions |
| `maxSize` | `number` | `5242880` (5MB) | Max file size in bytes |
| `onFileSelect` | `(file) => void` | - | File selection callback |
| `onError` | `(error) => void` | - | Error callback |
| `disabled` | `boolean` | `false` | Disable upload |

### PreviewTable

Data preview with masking indicators.

```tsx
<PreviewTable
  showMaskedIndicators={boolean}
  onUnmask={(rowIndex: number, fieldName: string) => void}
  maxRows={number}
  className={string}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showMaskedIndicators` | `boolean` | `true` | Show masking badges |
| `onUnmask` | `function` | - | Unmask callback |
| `maxRows` | `number` | `100` | Max rows to display |

### ImportProgress

Import progress display.

```tsx
<ImportProgress
  showErrors={boolean}
  onCancel={() => void}
  className={string}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showErrors` | `boolean` | `true` | Show error list |
| `onCancel` | `() => void` | - | Cancel callback |

### MaskedFieldBadge

Sensitivity level badge.

```tsx
<MaskedFieldBadge
  sensitivity={SensitivityLevel}
  canUnmask={boolean}
  onUnmask={() => void}
  className={string}
/>
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sensitivity` | `SensitivityLevel` | Yes | Sensitivity level |
| `canUnmask` | `boolean` | No | Show unmask button |
| `onUnmask` | `() => void` | No | Unmask callback |

---

## React Hooks

### useDataSpec

Main workflow management hook.

```tsx
const {
  // State
  entities: EntityDefinition[],
  specs: SpecDefinition[],
  selectedEntity: EntityDefinition | null,
  selectedSpec: SpecDefinition | null,
  fileUpload: FileUploadState,
  preview: PreviewResult | null,
  importProgress: ImportProgress,
  error: string | null,

  // Derived state
  currentStep: WorkflowStep,
  canPreview: boolean,
  canImport: boolean,
  isImporting: boolean,

  // Actions
  selectEntity: (entity: EntityDefinition | null) => void,
  selectSpec: (spec: SpecDefinition | null) => void,
  loadEntities: () => Promise<void>,
  loadSpecs: (entityId: string) => Promise<void>,
  startNewWorkflow: () => void,
  reset: () => void,
} = useDataSpec();
```

### useImport

Import operations hook.

```tsx
const {
  // State
  file: File | null,
  fileName: string,
  fileSize: number,
  preview: PreviewResult | null,
  importProgress: ImportProgress,
  importResult: ImportResult | null,
  error: string | null,

  // Derived state
  isReady: {
    forUpload: boolean,
    forPreview: boolean,
    forImport: boolean,
  },
  phaseDescription: string,
  progressPercent: number,

  // Actions
  setFile: (file: File | null) => void,
  clearFile: () => void,
  uploadFile: (file: File) => Promise<void>,
  generatePreview: () => Promise<PreviewResult | null>,
  startImport: () => Promise<ImportResult | null>,
  cancelImport: () => void,
  reset: () => void,
} = useImport(options?: UseImportOptions);
```

**Options:**

```tsx
interface UseImportOptions {
  autoPreview?: boolean;          // Auto-generate preview after file upload
  onPreviewReady?: (preview: PreviewResult) => void;
  onImportComplete?: (result: ImportResult) => void;
  onError?: (error: string) => void;
}
```

### useExport

Export operations hook.

```tsx
const {
  // State
  entity: EntityDefinition | null,
  spec: SpecDefinition | null,
  options: ExportOptions,
  lastExport: ExportResult | null,
  error: string | null,
  canUnmask: boolean,

  // Derived state
  isReady: boolean,
  isExporting: boolean,

  // Actions
  updateOptions: (options: Partial<ExportOptions>) => void,
  setFormat: (format: 'csv' | 'json' | 'xlsx') => void,
  toggleMasking: () => void,
  setFilters: (filters: Record<string, any>) => void,
  setFields: (fields: string[]) => void,
  startExport: (options?: Partial<ExportOptions>) => Promise<ExportResult | null>,
  exportAsCsv: (options?: Partial<ExportOptions>) => Promise<ExportResult | null>,
  exportAsJson: (options?: Partial<ExportOptions>) => Promise<ExportResult | null>,
  exportAsExcel: (options?: Partial<ExportOptions>) => Promise<ExportResult | null>,
  exportUnmasked: (options?: Partial<ExportOptions>) => Promise<ExportResult | null>,
  downloadFile: (data: Blob, fileName: string, mimeType: string) => void,
  getMimeType: (format: string) => string,
  reset: () => void,
  clearError: () => void,
} = useExport(options?: UseExportOptions);
```

**Options:**

```tsx
interface UseExportOptions {
  defaultFormat?: 'csv' | 'json' | 'xlsx';
  defaultApplyMasking?: boolean;
  autoDownload?: boolean;
  onExportComplete?: (result: ExportResult) => void;
  onError?: (error: string) => void;
}
```

---

## Core Engine

### YAMLParser

```typescript
class YAMLParser {
  parse(yamlContent: string): DataSpecDefinition;
  validate(yamlContent: string): boolean;
  getErrors(yamlContent: string): ValidationError[];
}
```

### FieldTransformer

```typescript
class FieldTransformer {
  transform(value: any, rules: TransformRule[]): any;
  registerCustomTransform(name: string, fn: TransformFunction): void;
}

type TransformRule =
  | { type: 'trim' }
  | { type: 'uppercase' }
  | { type: 'lowercase' }
  | { type: 'parse_date'; format: string }
  | { type: 'parse_number' }
  | { type: 'parse_boolean' }
  | { type: 'round'; decimals: number }
  | { type: 'regex_extract'; pattern: string; group?: number }
  | { type: 'replace'; search: string; replace: string }
  | { type: 'default'; value: any }
  | { type: 'concat'; fields: string[]; separator?: string };
```

### LookupResolver

```typescript
class LookupResolver {
  constructor(adapter: DatabaseAdapter);

  lookup(
    table: string,
    key: string,
    value: any,
    options?: LookupOptions
  ): Promise<any | null>;

  lookupComposite(
    table: string,
    keys: string[],
    values: any[],
    options?: LookupOptions
  ): Promise<any | null>;

  clearCache(): void;
}

interface LookupOptions {
  fallback?: 'error' | 'skip' | 'default';
  defaultValue?: any;
  cache?: boolean;
}
```

### MaskingEngine

```typescript
class MaskingEngine {
  mask(value: any, config: MaskingConfig): string;
  unmask(masked: string, context: UnmaskContext): Promise<any>;
  canUnmask(userRoles: string[], requiredRoles: string[]): boolean;
}

interface MaskingConfig {
  sensitivity: SensitivityLevel;
  mode: 'full' | 'partial' | 'regex' | 'custom';
  replacement?: string;
  visibleChars?: number;
  pattern?: string;
  customMask?: (value: any) => string;
}
```

### HookExecutor

```typescript
class HookExecutor {
  register(hookPoint: HookPoint, handler: HookHandler): void;
  execute(hookPoint: HookPoint, data: any, context: HookContext): Promise<any>;
  unregister(hookPoint: HookPoint, handler?: HookHandler): void;
}

type HookPoint =
  | 'beforeValidateRow'
  | 'validateField'
  | 'beforeLookup'
  | 'performLookup'
  | 'transformField'
  | 'maskField'
  | 'unmaskField'
  | 'beforeInsert'
  | 'afterInsert';
```

### ImportExecutor

```typescript
class ImportExecutor {
  constructor(spec: DataSpecDefinition, adapter: DatabaseAdapter);

  execute(
    data: string,
    options: ImportExecuteOptions
  ): Promise<ImportResult>;
}

interface ImportExecuteOptions {
  mode: 'preview' | 'execute';
  batchSize?: number;
  maxRows?: number;
  onProgress?: (progress: ImportProgress) => void;
}
```

### ExportExecutor

```typescript
class ExportExecutor {
  constructor(spec: DataSpecDefinition, adapter: DatabaseAdapter);

  execute(options: ExportExecuteOptions): Promise<ExportResult>;
}

interface ExportExecuteOptions {
  format: 'csv' | 'json' | 'xlsx';
  applyMasking?: boolean;
  filters?: Record<string, any>;
  fields?: string[];
  limit?: number;
}
```

---

## Supabase Adapter

### SupabaseAdapter

```typescript
class SupabaseAdapter implements DatabaseAdapter {
  constructor(client: SupabaseClient, options?: AdapterOptions);

  setUser(userId: string, roles: string[]): void;

  find(table: string, query: QueryBuilder): Promise<any[]>;
  findOne(table: string, query: QueryBuilder): Promise<any | null>;
  insert(table: string, rows: any[]): Promise<InsertResult>;
  update(table: string, data: any, where: QueryBuilder): Promise<UpdateResult>;
  delete(table: string, where: QueryBuilder): Promise<DeleteResult>;

  lookup(table: string, key: string, value: any): Promise<any | null>;
  lookupComposite(table: string, keys: string[], values: any[]): Promise<any | null>;

  transaction(callback: (trx: Transaction) => Promise<void>): Promise<void>;
}
```

### RLSValidator

```typescript
class RLSValidator {
  constructor(client: SupabaseClient);

  canRead(table: string, userId: string): Promise<boolean>;
  canWrite(table: string, userId: string): Promise<boolean>;
  canAccessRow(table: string, rowId: string, userId: string, operation: string): Promise<boolean>;
  canUnmask(table: string, field: string, userId: string, requiredRoles: string[]): Promise<boolean>;
  getPermissions(userId: string): Promise<UserPermissions>;
}
```

### AuditLogger

```typescript
class AuditLogger {
  constructor(client: SupabaseClient);

  logImport(entry: ImportLogEntry): Promise<void>;
  logExport(entry: ExportLogEntry): Promise<void>;
  logUnmask(entry: UnmaskLogEntry): Promise<void>;
  getLogs(query: LogQuery): Promise<LogEntry[]>;
}
```

---

## TypeScript Types

### Core Types

```typescript
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
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PreviewResult {
  rows: PreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  columns: ColumnInfo[];
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ImportError[];
  duration: number;
}

interface ExportResult {
  success: boolean;
  data: Blob;
  fileName: string;
  mimeType: string;
  rowCount: number;
  maskedFieldCount: number;
}
```

### Configuration Types

```typescript
interface DataSpecProviderConfig {
  api: {
    baseUrl: string;
    headers?: Record<string, string>;
  };
}

interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  applyMasking?: boolean;
  includeHeaders?: boolean;
  filters?: Record<string, any>;
  fields?: string[];
}
```

---

## Related Documentation

- [Getting Started](./getting-started.md)
- [YAML Spec Guide](./yaml-spec-guide.md)
- [Architecture](../architecture.md)
- [Test Results](./TEST-RESULTS.md)
