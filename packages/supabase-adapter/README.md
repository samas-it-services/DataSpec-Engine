# @dataspec-engine/supabase-adapter

Supabase database adapter for DataSpec Engine - provides database integration, RLS validation, and audit logging.

## Installation

```bash
npm install @dataspec-engine/supabase-adapter
```

### Peer Dependencies

```bash
npm install @supabase/supabase-js @dataspec-engine/core
```

## Features

- **SupabaseAdapter** - DatabaseAdapter implementation for Supabase
- **RLSValidator** - Row Level Security policy validation
- **AuditLogger** - Comprehensive audit trail logging

## Quick Start

```typescript
import { createClient } from '@supabase/supabase-js';
import { SupabaseAdapter, RLSValidator, AuditLogger } from '@dataspec-engine/supabase-adapter';
import { ImportExecutor } from '@dataspec-engine/core';

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Create adapter
const adapter = new SupabaseAdapter(supabase);

// Use with ImportExecutor
const executor = new ImportExecutor(spec, adapter);
const result = await executor.execute(csvData, { mode: 'execute' });
```

## Modules

### SupabaseAdapter

Implements the `DatabaseAdapter` interface for Supabase.

```typescript
const adapter = new SupabaseAdapter(supabaseClient);

// Set user context for RLS
adapter.setUser(userId, ['admin', 'data_manager']);

// Query operations
const records = await adapter.find('users', {
  select: ['id', 'name', 'email'],
  filters: [{ field: 'status', value: 'active' }],
  limit: 100,
});

const user = await adapter.findOne('users', {
  filters: [{ field: 'id', value: userId }],
});

// Lookup operations
const result = await adapter.lookup('users', 'email', 'user@example.com');

const result = await adapter.lookupComposite(
  'orders',
  ['customer_id', 'order_date'],
  ['123', '2024-01-01']
);

// Insert/Update/Delete
const insertResult = await adapter.insert('users', [
  { name: 'John', email: 'john@example.com' },
]);

const updateResult = await adapter.update(
  'users',
  { status: 'inactive' },
  { filters: [{ field: 'id', value: '123' }] }
);

const deleteResult = await adapter.delete('users', {
  filters: [{ field: 'id', value: '123' }],
});

// Transaction support
await adapter.transaction(async (trx) => {
  await trx.insert('orders', [order]);
  await trx.insert('order_items', items);
});
```

### RLSValidator

Validate Row Level Security policies before operations.

```typescript
const validator = new RLSValidator(supabaseClient);

// Check if user can read from table
const canRead = await validator.canRead('transactions', userId);

// Check if user can write to table
const canWrite = await validator.canWrite('transactions', userId);

// Check specific row access
const canAccessRow = await validator.canAccessRow(
  'transactions',
  rowId,
  userId,
  'read'
);

// Validate masking permissions
const canUnmask = await validator.canUnmask(
  'transactions',
  'bank_account_id',
  userId,
  ['admin']
);

// Get user's effective permissions
const permissions = await validator.getPermissions(userId);
// { read: ['transactions', 'users'], write: ['transactions'], unmask: ['admin'] }
```

### AuditLogger

Log all data operations for compliance and debugging.

```typescript
const logger = new AuditLogger(supabaseClient);

// Log import operation
await logger.logImport({
  specId: 'spec-123',
  userId: 'user-456',
  operation: 'import',
  status: 'success',
  totalRows: 1000,
  successfulRows: 998,
  failedRows: 2,
  errorDetails: [
    { row: 45, field: 'email', error: 'Invalid format' },
  ],
  duration: 5432,
});

// Log export operation
await logger.logExport({
  specId: 'spec-123',
  userId: 'user-456',
  operation: 'export',
  format: 'csv',
  rowCount: 500,
  maskedFields: ['ssn', 'bank_account'],
});

// Log unmask event
await logger.logUnmask({
  specId: 'spec-123',
  userId: 'user-456',
  field: 'bank_account_id',
  rowId: 'row-789',
  reason: 'Customer support request #12345',
  ipAddress: '192.168.1.1',
});

// Query audit logs
const logs = await logger.getLogs({
  specId: 'spec-123',
  operation: 'import',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  limit: 100,
});
```

## Database Schema

Required tables (run migration):

```sql
-- Import/export logs
CREATE TABLE import_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID REFERENCES dataspec_definitions(id),
  user_id UUID REFERENCES auth.users(id),
  operation VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  total_rows INTEGER,
  successful_rows INTEGER,
  failed_rows INTEGER,
  error_details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unmask audit trail
CREATE TABLE unmask_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID REFERENCES dataspec_definitions(id),
  user_id UUID REFERENCES auth.users(id),
  field_name VARCHAR(255) NOT NULL,
  row_id VARCHAR(255) NOT NULL,
  reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE import_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmask_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own logs"
  ON import_export_logs FOR SELECT
  USING (user_id = auth.uid() OR user_has_permission('view_all_logs'));

CREATE POLICY "Only system can insert logs"
  ON import_export_logs FOR INSERT
  WITH CHECK (true);
```

## Configuration

```typescript
const adapter = new SupabaseAdapter(supabaseClient, {
  // Enable query logging
  debug: true,

  // Custom table names
  tables: {
    importLogs: 'custom_import_logs',
    unmaskLogs: 'custom_unmask_logs',
  },

  // Batch size for bulk operations
  batchSize: 100,

  // Retry configuration
  retry: {
    maxAttempts: 3,
    delay: 1000,
  },
});
```

## Error Handling

```typescript
import { DatabaseError, RLSError, ValidationError } from '@dataspec-engine/supabase-adapter';

try {
  await adapter.insert('users', data);
} catch (error) {
  if (error instanceof RLSError) {
    console.log('Permission denied:', error.message);
  } else if (error instanceof DatabaseError) {
    console.log('Database error:', error.code, error.message);
  }
}
```

## Testing

```bash
# Run tests
npm test

# With coverage
npm test -- --coverage
```

**Test Results:** 120 tests, 97.22% coverage

## Related Packages

- [@dataspec-engine/core](../core/README.md) - Core engine
- [@dataspec-engine/react](../react/README.md) - React UI components

## License

ISC
