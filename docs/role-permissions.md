# 🔐 Role-Based Permissions

> Granular role-based permissions for each entity operation.

---

## 👥 Target Audience

| Audience | What You'll Learn |
|----------|-------------------|
| 🔒 **Security Teams** | Permission design and configuration |
| 🏗️ **Architects** | Role architecture patterns |
| 💻 **Developers** | Permission checking implementation |

---

## 📋 Overview

Each entity defines separate role arrays for each operation type:
- `viewRoles` - Who can see the entity in the UI
- `importRoles` - Who can import data to the entity
- `exportRoles` - Who can export data from the entity

This allows fine-grained access control where different roles can have different capabilities.

## Permission Schema

```sql
-- Role permission columns
ALTER TABLE dataspec_entities
ADD COLUMN view_roles TEXT[] DEFAULT ARRAY['super_admin'],
ADD COLUMN import_roles TEXT[] DEFAULT ARRAY['super_admin'],
ADD COLUMN export_roles TEXT[] DEFAULT ARRAY['super_admin'];
```

## Permission Hierarchy

Permissions are checked in order:
1. **Operation Mode** - Does the mode allow this operation?
2. **Role Check** - Does the user have a role in the allowed list?

Both checks must pass for the operation to be permitted.

## Example Configurations

### Standard Business Entity (Full Access)

```sql
INSERT INTO dataspec_entities (
  name, display_name, table_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'transactions', 'Transactions', 'transactions', 'full',
  ARRAY['super_admin', 'admin', 'finance_incharge'],
  ARRAY['super_admin', 'admin'],
  ARRAY['super_admin', 'admin', 'finance_incharge']
);
```

### Audit Table (Export Only)

```sql
INSERT INTO dataspec_entities (
  name, display_name, table_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'transaction_audit', 'Transaction Audit', 'transaction_audit', 'export_only',
  ARRAY['super_admin', 'admin', 'finance_incharge', 'financial_auditor'],
  ARRAY[]::TEXT[],  -- No one can import (also blocked by mode)
  ARRAY['super_admin', 'admin', 'financial_auditor']
);
```

### System Table (Admin Only)

```sql
INSERT INTO dataspec_entities (
  name, display_name, table_name, operation_mode,
  view_roles, import_roles, export_roles
) VALUES (
  'user_roles', 'User Roles', 'user_roles', 'view_only',
  ARRAY['super_admin'],
  ARRAY['super_admin'],  -- Listed but blocked by mode
  ARRAY['super_admin']   -- Listed but blocked by mode
);
```

## TypeScript Usage

### Core Package

```typescript
import {
  EntityDefinition,
  hasEntityPermission
} from '@samas-it-services/dataspec-core';

const entity: EntityDefinition = {
  id: '1',
  name: 'transactions',
  displayName: 'Transactions',
  tableName: 'transactions',
  operationMode: 'full',
  permissions: {
    viewRoles: ['super_admin', 'admin', 'finance_incharge'],
    importRoles: ['super_admin', 'admin'],
    exportRoles: ['super_admin', 'admin', 'finance_incharge']
  },
  enabled: true
};

const userRoles = ['finance_incharge'];

// Check permissions
const canView = hasEntityPermission(entity, 'view', userRoles);   // true
const canImport = hasEntityPermission(entity, 'import', userRoles); // false
const canExport = hasEntityPermission(entity, 'export', userRoles); // true
```

### React Package

```tsx
import { useDataSpecContext } from '@samas-it-services/dataspec-react';

function ImportExportButtons() {
  const {
    selectedEntity,
    canImportSelected,
    canExportSelected
  } = useDataSpecContext();

  return (
    <div>
      <button disabled={!canImportSelected}>
        Import
      </button>
      <button disabled={!canExportSelected}>
        Export
      </button>
    </div>
  );
}
```

### Supabase Adapter

```typescript
import { SupabaseAdapter } from '@samas-it-services/dataspec-supabase-adapter';

const adapter = new SupabaseAdapter(supabaseClient);
adapter.setUser(userId, ['finance_incharge']);

// Get entities the user can import to
const importableEntities = await adapter.getEntitiesForUser('import');

// Check specific permission
const entity = await adapter.getEntityByName('transactions');
const canExport = adapter.canPerformOperation(entity, 'export');
```

## Common Role Patterns

### SAMAS Charity Finance Roles

| Role | Description | Typical Access |
|------|-------------|----------------|
| `super_admin` | Full system access | All operations on all entities |
| `admin` | Administrative access | Most operations except system tables |
| `finance_incharge` | Financial operations | View/export financial data |
| `financial_auditor` | Audit access | Export audit tables |
| `zonal_incharge` | Zone management | View zone-related entities |

### Permission Matrix Example

| Entity | View Roles | Import Roles | Export Roles |
|--------|------------|--------------|--------------|
| transactions | admin, finance_incharge | admin | admin, finance_incharge |
| transaction_audit | admin, finance_incharge, financial_auditor | (none) | admin, financial_auditor |
| user_roles | super_admin | super_admin | super_admin |
| zones | admin, zonal_incharge | admin | admin |

## PostgreSQL Permission Function

```sql
-- Check if user can perform an operation
CREATE OR REPLACE FUNCTION dataspec_check_permission(
    p_entity_name TEXT,
    p_operation TEXT,
    p_user_roles TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_entity RECORD;
    v_allowed_roles TEXT[];
BEGIN
    SELECT * INTO v_entity
    FROM dataspec_entities
    WHERE name = p_entity_name AND enabled = true;

    IF v_entity IS NULL THEN
        RETURN false;
    END IF;

    -- Check operation mode
    CASE p_operation
        WHEN 'view' THEN
            v_allowed_roles := v_entity.view_roles;
        WHEN 'import' THEN
            IF v_entity.operation_mode IN ('export_only', 'view_only') THEN
                RETURN false;
            END IF;
            v_allowed_roles := v_entity.import_roles;
        WHEN 'export' THEN
            IF v_entity.operation_mode IN ('view_only', 'import_only') THEN
                RETURN false;
            END IF;
            v_allowed_roles := v_entity.export_roles;
        ELSE
            RETURN false;
    END CASE;

    -- Check if user has any allowed role
    RETURN v_allowed_roles && p_user_roles;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT dataspec_check_permission('transactions', 'export', ARRAY['finance_incharge']);
-- Returns: true
```

## Security Considerations

1. **Empty Role Arrays**: An empty role array means no one can perform that operation
2. **Mode + Role**: Both operation mode and role must permit the action
3. **Audit Trail**: Always log permission checks for sensitive operations
4. **Least Privilege**: Assign the minimum roles necessary
5. **Role Validation**: Validate role names against known values

## 📚 Related Documentation

- [🔒 Operation Modes](./operation-modes.md) - Configure entity restrictions
- [📝 YAML Specification Guide](./yaml-spec-guide.md) - Complete specification format
- [📖 API Reference](./api-reference.md) - Full API documentation
- [🏗️ Integration Guide](./integration-guide.md) - Step-by-step integration

### 🏭 Industry Examples

- [💰 Financial Services](./industries/finance.md) - Financial role patterns
- [🏥 Healthcare](./industries/healthcare.md) - Healthcare role configurations
- [⛽ Oil & Gas](./industries/oil-gas.md) - Energy sector roles
