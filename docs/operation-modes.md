# 🔒 Entity Operation Modes

> Control what operations are allowed on each entity.

---

## 👥 Target Audience

| Audience | What You'll Learn |
|----------|-------------------|
| 🏗️ **Architects** | Operation mode design patterns |
| 💻 **Developers** | Implementation and configuration |
| 🔒 **Security Teams** | Access control strategies |

---

## 📋 Overview

Operation modes provide entity-level restrictions that are checked before role-based permissions. This allows you to configure some entities as read-only (audit tables), while others have full CRUD capabilities.

## Operation Mode Types

| Mode | View | Import | Export | Use Case |
|------|------|--------|--------|----------|
| `full` | Y | Y | Y | Standard data entities |
| `export_only` | Y | N | Y | Audit logs, historical data |
| `view_only` | Y | N | N | System tables, reference data |
| `import_only` | Y | Y | N | Staging tables |

### Full Mode

The default mode. All operations are allowed based on role permissions.

```sql
INSERT INTO dataspec_entities (name, operation_mode, ...)
VALUES ('transactions', 'full', ...);
```

### Export Only Mode

Used for audit tables and historical data that should never be modified via import.

```sql
INSERT INTO dataspec_entities (name, operation_mode, ...)
VALUES ('transaction_audit', 'export_only', ...);
```

### View Only Mode

Used for system reference tables that should be visible but not importable or exportable.

```sql
INSERT INTO dataspec_entities (name, operation_mode, ...)
VALUES ('user_roles', 'view_only', ...);
```

### Import Only Mode

Used for staging tables where data can be uploaded but should not be exported.

```sql
INSERT INTO dataspec_entities (name, operation_mode, ...)
VALUES ('import_staging', 'import_only', ...);
```

## Permission Checking

Permission checking is a two-step process:

1. **Mode Check**: First verify the operation mode allows the operation
2. **Role Check**: Then verify the user has a role that permits the operation

### TypeScript Example

```typescript
import {
  OperationMode,
  EntityDefinition,
  isOperationAllowedByMode,
  hasEntityPermission
} from '@samas-it-services/dataspec-core';

const entity: EntityDefinition = {
  id: 'audit-1',
  name: 'transaction_audit',
  displayName: 'Transaction Audit',
  tableName: 'transaction_audit',
  operationMode: OperationMode.EXPORT_ONLY,
  permissions: {
    viewRoles: ['admin', 'finance_incharge', 'financial_auditor'],
    importRoles: [], // Empty - no one can import
    exportRoles: ['admin', 'super_admin', 'financial_auditor']
  },
  enabled: true
};

const userRoles = ['financial_auditor'];

// Check mode first
const modeAllowsImport = isOperationAllowedByMode(entity.operationMode, 'import');
// Returns: false (export_only mode doesn't allow import)

// Full permission check (mode + roles)
const canExport = hasEntityPermission(entity, 'export', userRoles);
// Returns: true (mode allows export, user has financial_auditor role)
```

### PostgreSQL Example

```sql
-- Check if user can perform operation
SELECT dataspec_check_permission(
  'transaction_audit',  -- entity name
  'import',             -- operation
  ARRAY['financial_auditor']  -- user roles
);
-- Returns: false (export_only mode denies import)

SELECT dataspec_check_permission(
  'transaction_audit',
  'export',
  ARRAY['financial_auditor']
);
-- Returns: true (mode allows, role has permission)
```

## Database Schema

```sql
-- Operation mode column
ALTER TABLE dataspec_entities ADD COLUMN operation_mode TEXT DEFAULT 'full'
    CHECK (operation_mode IN ('full', 'export_only', 'view_only', 'import_only'));
```

## Best Practices

1. **Audit Tables**: Always use `export_only` - never allow imports to audit tables
2. **System Config**: Use `view_only` for tables like user_roles, system_settings
3. **Link Tables**: Use `view_only` for junction tables managed by the application
4. **Staging Tables**: Use `import_only` if you have temporary import tables
5. **Standard Entities**: Use `full` for normal business entities

## Entity Categories

Entities can be grouped by category for UI organization:

| Category | Description | Typical Mode |
|----------|-------------|--------------|
| `core` | Business entities | `full` |
| `financial` | Financial records | `full` |
| `audit` | Audit trail tables | `export_only` |
| `system` | System configuration | `view_only` |
| `link` | Junction tables | `view_only` |
| `general` | Default category | `full` |

## Migration Example

```sql
-- Add columns to existing table
ALTER TABLE dataspec_entities
ADD COLUMN IF NOT EXISTS operation_mode TEXT DEFAULT 'full'
    CHECK (operation_mode IN ('full', 'export_only', 'view_only', 'import_only'));

-- Update audit tables to export_only
UPDATE dataspec_entities
SET operation_mode = 'export_only'
WHERE name LIKE '%_audit';
```

## 📚 Related Documentation

- [🔐 Role-Based Permissions](./role-permissions.md) - Set up role-based access
- [📝 YAML Specification Guide](./yaml-spec-guide.md) - Complete specification format
- [📖 API Reference](./api-reference.md) - Full API documentation
- [🏗️ Integration Guide](./integration-guide.md) - Step-by-step integration

### 🏭 Industry Examples

- [💰 Financial Services](./industries/finance.md) - SOX compliance patterns
- [🏥 Healthcare](./industries/healthcare.md) - HIPAA entity configurations
- [⛽ Oil & Gas](./industries/oil-gas.md) - Sensor data patterns
