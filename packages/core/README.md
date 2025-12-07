# @dataspec-engine/core

Core engine for DataSpec - YAML parsing, validation, transformation, masking, and import/export execution.

## Installation

```bash
npm install @dataspec-engine/core
```

## Features

- **YAML Parser** - JSON Schema validated YAML specification parsing
- **Field Transformer** - 11 transformation types
- **Lookup Resolver** - Single and composite key lookups with caching
- **Masking Engine** - 5 sensitivity levels, 4 masking modes
- **Hook Executor** - 9 extensibility hook points
- **Import/Export Executors** - Full data processing pipelines

## Quick Start

```typescript
import {
  YAMLParser,
  ImportExecutor,
  ExportExecutor,
  FieldTransformer,
  MaskingEngine,
} from '@dataspec-engine/core';

// Parse a YAML specification
const parser = new YAMLParser();
const spec = parser.parse(yamlContent);

// Transform fields
const transformer = new FieldTransformer();
const result = transformer.transform('  HELLO  ', [
  { type: 'trim' },
  { type: 'lowercase' },
]);
// result: 'hello'

// Apply masking
const masking = new MaskingEngine();
const masked = masking.mask('secret-value', {
  sensitivity: 'confidential',
  mode: 'partial',
});
// masked: 'sec***lue'
```

## Modules

### YAMLParser

Parse and validate YAML specifications.

```typescript
const parser = new YAMLParser();

// Parse with validation
const spec = parser.parse(yamlContent);

// Validate only
const isValid = parser.validate(yamlContent);

// Get validation errors
const errors = parser.getErrors(yamlContent);
```

### FieldTransformer

Transform field values using 11 transformation types.

```typescript
const transformer = new FieldTransformer();

// Available transformations
transformer.transform(value, [
  { type: 'trim' },
  { type: 'uppercase' },
  { type: 'lowercase' },
  { type: 'parse_date', format: 'YYYY-MM-DD' },
  { type: 'parse_number' },
  { type: 'parse_boolean' },
  { type: 'round', decimals: 2 },
  { type: 'regex_extract', pattern: '([0-9]+)', group: 1 },
  { type: 'replace', search: 'old', replace: 'new' },
  { type: 'default', value: 'default' },
  { type: 'concat', fields: ['first', 'last'], separator: ' ' },
]);
```

### LookupResolver

Resolve foreign key lookups with caching.

```typescript
const resolver = new LookupResolver(databaseAdapter);

// Single key lookup
const result = await resolver.lookup('users', 'email', 'user@example.com');

// Composite key lookup
const result = await resolver.lookupComposite('orders',
  ['customer_id', 'order_date'],
  ['123', '2024-01-01']
);

// With fallback strategy
const result = await resolver.lookup('users', 'id', '999', {
  fallback: 'skip', // 'error' | 'skip' | 'default'
  defaultValue: null,
});
```

### MaskingEngine

Apply sensitivity-based masking.

```typescript
const engine = new MaskingEngine();

// Sensitivity levels
type SensitivityLevel =
  | 'public'           // No masking
  | 'internal'         // Partial masking
  | 'confidential'     // Full masking
  | 'secret'           // Full masking + audit
  | 'highly_restricted'; // Full masking + special permissions

// Masking modes
type MaskMode = 'full' | 'partial' | 'regex' | 'custom';

// Apply masking
const masked = engine.mask(value, {
  sensitivity: 'confidential',
  mode: 'partial',
  visibleChars: 3,
});

// Unmask (requires permissions)
const unmasked = await engine.unmask(masked, {
  userRoles: ['admin'],
  reason: 'Customer support request',
});
```

### HookExecutor

Execute custom JavaScript hooks at 9 points.

```typescript
const executor = new HookExecutor();

// Register hooks
executor.register('beforeValidateRow', (row, context) => {
  row.normalized_email = row.email.toLowerCase();
  return row;
});

executor.register('validateField:amount', (value, context) => {
  if (value < 0) throw new Error('Amount must be positive');
  return value;
});

// Hook points
// 1. beforeValidateRow
// 2. validateField
// 3. beforeLookup
// 4. performLookup
// 5. transformField
// 6. maskField
// 7. unmaskField
// 8. beforeInsert
// 9. afterInsert
```

### ImportExecutor

Execute full import pipeline.

```typescript
const executor = new ImportExecutor(spec, databaseAdapter);

// Preview mode (no database writes)
const preview = await executor.execute(csvData, {
  mode: 'preview',
  maxRows: 200,
});

// Execute mode (full import)
const result = await executor.execute(csvData, {
  mode: 'execute',
  batchSize: 100,
  onProgress: (progress) => console.log(progress),
});

// Result structure
interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ImportError[];
  duration: number;
}
```

### ExportExecutor

Export data with masking.

```typescript
const executor = new ExportExecutor(spec, databaseAdapter);

const result = await executor.execute({
  format: 'csv', // 'csv' | 'json' | 'xlsx'
  applyMasking: true,
  filters: { status: 'active' },
  fields: ['id', 'name', 'email'],
});
```

## Types

Key TypeScript interfaces:

```typescript
interface DataSpecDefinition {
  version: string;
  metadata: SpecMetadata;
  database: DatabaseConfig;
  columns: ColumnDefinition[];
  hooks?: HookDefinition[];
  importOptions?: ImportOptions;
  exportOptions?: ExportOptions;
}

interface ColumnDefinition {
  name: string;
  source: string;
  type: FieldType;
  required?: boolean;
  sensitivity?: SensitivityLevel;
  validation?: ValidationRule[];
  transform?: TransformRule[];
  lookup?: LookupConfig;
  masking?: MaskingConfig;
}
```

## Testing

```bash
# Run tests
npm test

# With coverage
npm test -- --coverage
```

**Test Results:** 320 tests, 94.26% coverage

## Related Packages

- [@dataspec-engine/react](../react/README.md) - React UI components
- [@dataspec-engine/supabase-adapter](../supabase-adapter/README.md) - Supabase integration

## License

ISC
