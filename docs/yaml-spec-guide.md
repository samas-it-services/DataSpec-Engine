# DataSpec YAML Specification Guide

> Complete reference for writing DataSpec YAML specification files.

---

## Target Audience

| Audience | What You'll Learn |
|----------|-------------------|
| **Developers** | Column mappings, validation, transformation syntax |
| **Architects** | Specification patterns, lookup strategies, hooks |
| **Data Engineers** | Import/export configuration, masking rules |

---

## Quick Start

### Minimal Working Example

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json
version: "1.0"

metadata:
  name: "users-import"
  entity: "users"

database:
  table: "users"
  primary_key: "id"

columns:
  - name: "id"
    source: "User ID"
    type: "uuid"
    required: true
    sensitivity: "internal"
```

### Enable IDE Auto-Completion

Add this line at the top of your YAML file:

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json
```

See [SCHEMA.md](./SCHEMA.md) for VS Code workspace configuration.

---

## Table of Contents

- [Root Properties](#root-properties)
- [Metadata Section](#metadata-section)
- [Database Section](#database-section)
- [Columns Section](#columns-section)
- [Data Types](#data-types)
- [Validation Rules](#validation-rules)
- [Transformations](#transformations)
- [Lookups](#lookups)
- [Sensitivity & Masking](#sensitivity--masking)
- [Hooks](#hooks)
- [Import Options](#import-options)
- [Export Options](#export-options)
- [Complete Examples](#complete-examples)
- [Naming Conventions](#naming-conventions)

---

## Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `version` | string | Yes | Spec format version (e.g., `"1.0"`, `"1.2.3"`) |
| `metadata` | object | Yes | Specification identification and documentation |
| `database` | object | Yes | Target database table configuration |
| `columns` | array | Yes | Column mapping definitions (min 1) |
| `hooks` | object | No | Custom JavaScript hooks |
| `import_options` | object | No | Import behavior settings |
| `export_options` | object | No | Export behavior settings |

---

## Metadata Section

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique spec identifier (use snake_case or kebab-case) |
| `entity` | string | Yes | Entity type for grouping specs |
| `description` | string | No | Human-readable description |
| `author` | string | No | Author name or email |
| `created_at` | string | No | Creation date (YYYY-MM-DD) |
| `tags` | array | No | Tags for categorization |
| `version` | string | No | Spec version (separate from format version) |

### Example

```yaml
metadata:
  name: "transactions-monthly-import"
  entity: "transactions"
  description: "Import monthly bank transaction exports"
  author: "Finance Team"
  created_at: "2024-01-15"
  tags: ["finance", "monthly", "automated"]
  version: "2.1.0"
```

---

## Database Section

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `table` | string | Yes | Target database table name |
| `primary_key` | string | Yes | Primary key column for duplicate detection |
| `schema` | string | No | Database schema (default: public) |

### Example

```yaml
database:
  table: "transactions"
  primary_key: "id"
  schema: "finance"
```

---

## Columns Section

Each column defines how to map, validate, transform, and optionally mask data from source to database.

### Column Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Target column name in database |
| `source` | string | Yes | Source column header from CSV/Excel |
| `type` | string | Yes | Data type (see [Data Types](#data-types)) |
| `required` | boolean | Yes | Whether field must have a value |
| `sensitivity` | string | Yes | Data classification level |
| `validation` | array | No | Validation rules to apply |
| `transform` | array | No | Transformations to apply (in order) |
| `masking` | object | No | Masking configuration |
| `unmask_permissions` | array | No | Roles that can unmask data |
| `lookup` | object | No | Foreign key lookup configuration |
| `default` | any | No | Default value when source is empty |

### Basic Example

```yaml
columns:
  - name: "amount"
    source: "Transaction Amount"
    type: "decimal"
    required: true
    sensitivity: "confidential"
    default: 0
```

---

## Data Types

| Type | Description | Example Values |
|------|-------------|----------------|
| `string` | General text | `"Hello World"` |
| `text` | Long text (unlimited) | Multi-paragraph content |
| `integer` | Whole number | `42`, `-100` |
| `number` | Float/double | `3.14159` |
| `decimal` | Precise decimal (currency) | `123.45` |
| `boolean` | True/false | `true`, `false` |
| `date` | Date only | `"2024-01-15"` |
| `datetime` | Date and time | `"2024-01-15T10:30:00Z"` |
| `time` | Time only | `"14:30:00"` |
| `uuid` | UUID format | `"550e8400-e29b-41d4-a716-446655440000"` |
| `json` | JSON object | `{"key": "value"}` |
| `array` | Array of values | `["a", "b", "c"]` |

---

## Validation Rules

### Available Validation Types

| Type | Required Properties | Description |
|------|---------------------|-------------|
| `required` | none | Value must be present and non-empty |
| `uuid` | none | Must be valid UUID format |
| `email` | none | Must be valid email address |
| `url` | none | Must be valid URL |
| `regex` | `pattern` | Must match regex pattern |
| `range` | `min` and/or `max` | Numeric value must be in range |
| `length` | `min` and/or `max` | String length must be in range |
| `enum` | `values` | Must be one of specified values |
| `custom` | `script` | Custom JavaScript validation |

### Validation Properties Reference

| Property | Type | Used By | Description |
|----------|------|---------|-------------|
| `type` | string | All | Validation type (required) |
| `message` | string | All | Custom error message |
| `pattern` | string | `regex` | Regex pattern to match |
| `flags` | string | `regex` | Regex flags (i, g, m) |
| `min` | number | `range`, `length` | Minimum value/length |
| `max` | number | `range`, `length` | Maximum value/length |
| `values` | array | `enum` | Allowed values |
| `script` | string | `custom` | JavaScript code |

### Examples

```yaml
validation:
  # Required field
  - type: "required"
    message: "This field cannot be empty"

  # UUID format
  - type: "uuid"
    message: "Must be a valid UUID"

  # Email format
  - type: "email"

  # Regex pattern
  - type: "regex"
    pattern: "^[A-Z]{2}\\d{6}$"
    flags: "i"
    message: "Must be 2 letters followed by 6 digits"

  # Numeric range
  - type: "range"
    min: 0
    max: 1000000
    message: "Amount must be between 0 and 1,000,000"

  # String length
  - type: "length"
    min: 2
    max: 100
    message: "Name must be 2-100 characters"

  # Enumeration
  - type: "enum"
    values: ["active", "inactive", "pending"]
    message: "Status must be active, inactive, or pending"

  # Custom validation
  - type: "custom"
    script: |
      if (parseFloat(value) > row.max_amount) {
        throw new Error('Amount exceeds maximum');
      }
      return true;
```

---

## Transformations

### Available Transformation Types

| Type | Required Properties | Description |
|------|---------------------|-------------|
| `trim` | none | Remove leading/trailing whitespace |
| `uppercase` | none | Convert to uppercase |
| `lowercase` | none | Convert to lowercase |
| `capitalize` | none | Capitalize first letter of each word |
| `parse_date` | `format` | Parse string to date |
| `format_date` | `format` | Format date to string |
| `round` | none | Round to decimal places |
| `floor` | none | Round down |
| `ceil` | none | Round up |
| `regex_extract` | `pattern` | Extract using regex capture group |
| `regex_replace` | `pattern`, `replacement` | Replace using regex |
| `split` | `delimiter` | Split string into array |
| `join` | `delimiter` | Join array into string |
| `custom` | `script` | Custom JavaScript transformation |

### Transformation Properties Reference

| Property | Type | Used By | Description |
|----------|------|---------|-------------|
| `type` | string | All | Transformation type (required) |
| `format` | string | `parse_date`, `format_date` | Date format (moment.js/dayjs) |
| `timezone` | string | `parse_date`, `format_date` | IANA timezone |
| `decimals` | integer | `round`, `floor`, `ceil` | Decimal places (default: 0) |
| `pattern` | string | `regex_extract`, `regex_replace` | Regex pattern |
| `capture_group` | integer | `regex_extract` | Capture group (0=full match) |
| `target_field` | string | `regex_extract` | Store result in different field |
| `flags` | string | `regex_*` | Regex flags |
| `replacement` | string | `regex_replace` | Replacement string |
| `delimiter` | string | `split`, `join` | Delimiter character |
| `index` | integer | `split` | Array index to select |
| `script` | string | `custom` | JavaScript code |

### Examples

```yaml
transform:
  # String transformations
  - type: "trim"
  - type: "uppercase"
  - type: "lowercase"
  - type: "capitalize"

  # Date parsing
  - type: "parse_date"
    format: "MM/DD/YYYY"
    timezone: "America/New_York"

  # Date formatting
  - type: "format_date"
    format: "YYYY-MM-DD"
    timezone: "UTC"

  # Numeric rounding
  - type: "round"
    decimals: 2

  # Regex extraction
  - type: "regex_extract"
    pattern: "Invoice #(\\d+)"
    capture_group: 1
    target_field: "invoice_number"

  # Regex replacement
  - type: "regex_replace"
    pattern: "[^0-9]"
    replacement: ""
    flags: "g"

  # Split string
  - type: "split"
    delimiter: ","
    index: 0

  # Join array
  - type: "join"
    delimiter: ", "

  # Custom transformation
  - type: "custom"
    script: |
      return value.toUpperCase().replace(/\s+/g, '_');
```

### Chained Transformations

Transformations are applied in order:

```yaml
transform:
  - type: "trim"         # Step 1: Remove whitespace
  - type: "lowercase"    # Step 2: Convert to lowercase
  - type: "regex_replace"
    pattern: "\\s+"
    replacement: "_"     # Step 3: Replace spaces with underscores
```

---

## Lookups

Lookups resolve human-readable values to database foreign keys.

### Lookup Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `table` | string | Yes | Reference table to lookup |
| `key` | string/array | Yes | Column(s) to match against |
| `source_field` | string | No | Source field if different from column |
| `return_field` | string | No | Column to return (default: primary key) |
| `fallback` | string | Yes | Action when lookup fails |
| `default_value` | any | No | Default when fallback='default' |
| `cache` | boolean | No | Enable caching (default: true) |
| `cache_ttl` | integer | No | Cache TTL in seconds (default: 300) |

### Fallback Strategies

| Fallback | Description |
|----------|-------------|
| `error` | Fail the entire row |
| `skip` | Skip the row entirely |
| `default` | Use `default_value` |
| `null` | Set value to null |

### Single Key Lookup

```yaml
columns:
  - name: "zone_id"
    source: "Zone Name"
    type: "uuid"
    required: true
    sensitivity: "internal"
    lookup:
      table: "zones"
      key: "name"
      return_field: "id"
      fallback: "error"
      cache: true
      cache_ttl: 300
```

### Composite Key Lookup

For lookups requiring multiple columns:

```yaml
columns:
  - name: "subzone_id"
    source: "Subzone Code"
    type: "uuid"
    required: true
    sensitivity: "internal"
    lookup:
      table: "subzones"
      key: ["zone_code", "subzone_code"]  # Composite key
      fallback: "default"
      default_value: null
```

### Lookup with Different Source Field

When the lookup value comes from a different column than the target:

```yaml
columns:
  - name: "customer_id"
    source: "Customer Email"
    type: "uuid"
    required: true
    sensitivity: "internal"
    lookup:
      table: "customers"
      key: "email"
      source_field: "customer_email_raw"  # Use different source
      return_field: "id"
      fallback: "skip"
```

---

## Sensitivity & Masking

### Sensitivity Levels

| Level | Description | Default Behavior |
|-------|-------------|------------------|
| `public` | No restrictions | No masking |
| `internal` | Company-internal | Visible to authenticated users |
| `confidential` | Need-to-know basis | Masked by default |
| `secret` | Highly sensitive | Masked, audit logging |
| `highly_restricted` | Maximum protection | Masked, special permissions required |

### Masking Configuration

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `mode` | string | Yes | Masking mode |
| `replacement` | string | No | Replacement character(s) (default: `*`) |
| `visible_chars` | integer | No | Characters to keep visible (partial mode) |
| `position` | string | No | Which end visible: `start` or `end` (default: `end`) |
| `partial_start` | integer | No | Chars visible at start (explicit mode) |
| `partial_end` | integer | No | Chars visible at end (explicit mode) |
| `regex_pattern` | string | No | Pattern for regex mode |
| `custom_script` | string | No | JavaScript for custom mode |

### Masking Modes

| Mode | Description | Example |
|------|-------------|---------|
| `full` | Replace entire value | `"John Doe"` -> `"********"` |
| `partial` | Keep some chars visible | `"123-45-6789"` -> `"***-**-6789"` |
| `regex` | Pattern-based masking | Custom patterns |
| `custom` | JavaScript function | Complex logic |

### Masking Examples

**Full Masking:**
```yaml
masking:
  mode: "full"
  replacement: "***MASKED***"
```

**Partial Masking (Simple):**
```yaml
# Show last 4 characters
masking:
  mode: "partial"
  visible_chars: 4
  position: "end"        # "end" = last 4, "start" = first 4
  replacement: "*"
```

**Partial Masking (Explicit):**
```yaml
# Show first 4 and last 4 characters
masking:
  mode: "partial"
  partial_start: 4       # First 4 visible
  partial_end: 4         # Last 4 visible
  replacement: "*"
# "4111111111111111" -> "4111********1111"
```

**Regex Masking:**
```yaml
masking:
  mode: "regex"
  regex_pattern: "\\d{4}(?=\\d{4})"  # Mask middle digits
  replacement: "****"
```

**Custom Masking:**
```yaml
masking:
  mode: "custom"
  custom_script: |
    const parts = value.split('@');
    return parts[0].substring(0, 2) + '***@' + parts[1];
# "john.doe@example.com" -> "jo***@example.com"
```

### Unmask Permissions

```yaml
columns:
  - name: "ssn"
    source: "Social Security Number"
    type: "string"
    required: true
    sensitivity: "highly_restricted"
    masking:
      mode: "partial"
      visible_chars: 4
      position: "end"
    unmask_permissions:
      - "super_admin"
      - "hr_manager"
      - "compliance_officer"
```

---

## Hooks

Hooks allow custom JavaScript logic at specific execution points.

### Available Hook Points

| Hook | Execution Point | Context Variables |
|------|-----------------|-------------------|
| `before_validate_row` | Before row validation | `row`, `rowIndex`, `context` |
| `validate_field` | Custom field validation | `value`, `row`, `column`, `context` |
| `before_lookup` | Before lookup execution | `value`, `lookupConfig`, `context` |
| `perform_lookup` | Custom lookup logic | `value`, `lookupConfig`, `adapter`, `context` |
| `transform_field` | Custom transformation | `value`, `row`, `column`, `context` |
| `mask_field` | Custom masking | `value`, `maskingConfig`, `context` |
| `unmask_field` | Custom unmasking | `value`, `maskingConfig`, `userRoles`, `context` |
| `before_insert` | Before database insert | `row`, `context` |
| `after_insert` | After successful insert | `row`, `insertedRow`, `context` |

### Hook Definition Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Unique hook name (for logging) |
| `field` | string | No | Specific field (omit for row-level) |
| `script` | string | Yes | JavaScript code to execute |

### Hook Examples

```yaml
hooks:
  # Normalize row data before validation
  before_validate_row:
    - name: "normalize_row"
      script: |
        row.email = row.email?.toLowerCase().trim();
        row.phone = row.phone?.replace(/[^0-9+]/g, '');
        return row;

  # Custom field validation
  validate_field:
    - name: "validate_amount"
      field: "amount"
      script: |
        if (parseFloat(value) < 0 && row.type !== 'refund') {
          throw new Error('Negative amounts only allowed for refunds');
        }
        return true;

  # Modify lookup parameters
  before_lookup:
    - name: "normalize_lookup_key"
      script: |
        return value?.toUpperCase().trim();

  # Custom lookup logic
  perform_lookup:
    - name: "fuzzy_customer_lookup"
      field: "customer_id"
      script: |
        const result = await adapter.query(
          'SELECT id FROM customers WHERE LOWER(email) = LOWER($1)',
          [value]
        );
        return result[0]?.id || null;

  # Add audit fields before insert
  before_insert:
    - name: "add_audit_fields"
      script: |
        row.created_at = new Date().toISOString();
        row.created_by = context.userId;
        row.import_batch_id = context.batchId;
        return row;

  # Post-insert notification
  after_insert:
    - name: "notify_large_transaction"
      script: |
        if (parseFloat(row.amount) > 10000) {
          await context.notify('large_transaction', {
            id: insertedRow.id,
            amount: row.amount
          });
        }
```

### Hook Context Object

```javascript
context = {
  userId: string,           // Current user ID
  userRoles: string[],      // User's roles
  batchId: string,          // Import batch ID
  rowIndex: number,         // Current row index (0-based)
  totalRows: number,        // Total rows being processed
  spec: DataSpecDefinition, // Full spec definition
  adapter: DatabaseAdapter, // Database adapter for queries
  logger: Logger,           // Logger instance
  notify: Function          // Notification function
}
```

---

## Import Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `duplicate_strategy` | string | `"skip"` | How to handle duplicates |
| `batch_size` | integer | `100` | Rows per batch (1-10000) |
| `validate_foreign_keys` | boolean | `true` | Validate lookup references exist |
| `auto_generate_ids` | boolean | `false` | Auto-generate UUIDs for primary key |

### Duplicate Strategies

| Strategy | Description |
|----------|-------------|
| `skip` | Silently skip duplicate rows |
| `update` | Update existing rows (upsert) |
| `error` | Fail when duplicate found |

### Example

```yaml
import_options:
  duplicate_strategy: "update"
  batch_size: 500
  validate_foreign_keys: true
  auto_generate_ids: true
```

---

## Export Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `apply_masking` | boolean | `true` | Apply masking rules on export |
| `include_audit_fields` | boolean | `false` | Include created_at, updated_at, etc. |
| `format` | string | `"csv"` | Output format: `csv`, `excel`, `json` |

### Example

```yaml
export_options:
  apply_masking: true
  include_audit_fields: false
  format: "csv"
```

---

## Complete Examples

### Financial Transaction Import

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json
version: "1.0"

metadata:
  name: "bank-transactions-import"
  entity: "transactions"
  description: "Import monthly bank transaction exports"
  author: "Finance Team"
  tags: ["finance", "bank", "monthly"]

database:
  table: "transactions"
  primary_key: "id"

columns:
  - name: "id"
    source: "Transaction ID"
    type: "uuid"
    required: true
    sensitivity: "internal"
    validation:
      - type: "uuid"

  - name: "transaction_date"
    source: "Date"
    type: "date"
    required: true
    sensitivity: "internal"
    transform:
      - type: "parse_date"
        format: "MM/DD/YYYY"

  - name: "amount"
    source: "Amount"
    type: "decimal"
    required: true
    sensitivity: "confidential"
    transform:
      - type: "round"
        decimals: 2
    validation:
      - type: "range"
        min: -1000000
        max: 1000000
    masking:
      mode: "full"
      replacement: "***"

  - name: "account_id"
    source: "Account Number"
    type: "uuid"
    required: true
    sensitivity: "secret"
    lookup:
      table: "bank_accounts"
      key: "account_number"
      return_field: "id"
      fallback: "error"
    masking:
      mode: "partial"
      visible_chars: 4
      position: "end"
    unmask_permissions:
      - "finance_admin"
      - "auditor"

  - name: "description"
    source: "Description"
    type: "text"
    required: false
    sensitivity: "internal"
    transform:
      - type: "trim"
    default: ""

  - name: "category"
    source: "Category"
    type: "string"
    required: true
    sensitivity: "public"
    transform:
      - type: "lowercase"
    validation:
      - type: "enum"
        values: ["income", "expense", "transfer"]
    default: "expense"

hooks:
  before_validate_row:
    - name: "normalize_amount_sign"
      script: |
        // Expenses should be negative
        if (row.category === 'expense' && parseFloat(row.amount) > 0) {
          row.amount = -parseFloat(row.amount);
        }
        return row;

  before_insert:
    - name: "add_import_metadata"
      script: |
        row.imported_at = new Date().toISOString();
        row.import_batch_id = context.batchId;
        return row;

import_options:
  duplicate_strategy: "skip"
  batch_size: 100
  validate_foreign_keys: true

export_options:
  apply_masking: true
  format: "csv"
```

### User Import with Department Lookup

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json
version: "1.0"

metadata:
  name: "user-import"
  entity: "users"
  description: "Import employee data from HR system"
  author: "HR Department"

database:
  table: "users"
  primary_key: "id"

columns:
  - name: "id"
    source: "Employee ID"
    type: "uuid"
    required: false
    sensitivity: "internal"

  - name: "email"
    source: "Email Address"
    type: "string"
    required: true
    sensitivity: "internal"
    transform:
      - type: "trim"
      - type: "lowercase"
    validation:
      - type: "email"
      - type: "length"
        max: 255

  - name: "full_name"
    source: "Full Name"
    type: "string"
    required: true
    sensitivity: "internal"
    transform:
      - type: "trim"
      - type: "capitalize"

  - name: "phone"
    source: "Phone Number"
    type: "string"
    required: false
    sensitivity: "confidential"
    transform:
      - type: "regex_replace"
        pattern: "[^0-9+]"
        replacement: ""
        flags: "g"
    masking:
      mode: "partial"
      visible_chars: 4
      position: "end"

  - name: "ssn"
    source: "SSN"
    type: "string"
    required: false
    sensitivity: "highly_restricted"
    validation:
      - type: "regex"
        pattern: "^\\d{3}-\\d{2}-\\d{4}$"
        message: "SSN must be in format XXX-XX-XXXX"
    masking:
      mode: "partial"
      partial_start: 0
      partial_end: 4
    unmask_permissions:
      - "super_admin"
      - "hr_manager"

  - name: "department_id"
    source: "Department"
    type: "uuid"
    required: false
    sensitivity: "internal"
    lookup:
      table: "departments"
      key: "name"
      return_field: "id"
      fallback: "null"
      cache: true

  - name: "role"
    source: "Role"
    type: "string"
    required: true
    sensitivity: "internal"
    transform:
      - type: "lowercase"
    validation:
      - type: "enum"
        values: ["admin", "manager", "employee", "contractor"]
    default: "employee"

import_options:
  duplicate_strategy: "update"
  batch_size: 50
  auto_generate_ids: true

export_options:
  apply_masking: true
  include_audit_fields: false
  format: "excel"
```

---

## Naming Conventions

DataSpec supports both **snake_case** (YAML) and **camelCase** (TypeScript) for all property names.

| YAML (snake_case) | TypeScript (camelCase) |
|-------------------|------------------------|
| `primary_key` | `primaryKey` |
| `visible_chars` | `visibleChars` |
| `partial_start` | `partialStart` |
| `partial_end` | `partialEnd` |
| `regex_pattern` | `regexPattern` |
| `custom_script` | `customScript` |
| `source_field` | `sourceField` |
| `return_field` | `returnField` |
| `default_value` | `defaultValue` |
| `cache_ttl` | `cacheTtl` |
| `capture_group` | `captureGroup` |
| `target_field` | `targetField` |
| `duplicate_strategy` | `duplicateStrategy` |
| `batch_size` | `batchSize` |
| `validate_foreign_keys` | `validateForeignKeys` |
| `auto_generate_ids` | `autoGenerateIds` |
| `apply_masking` | `applyMasking` |
| `include_audit_fields` | `includeAuditFields` |
| `before_validate_row` | `beforeValidateRow` |
| `validate_field` | `validateField` |
| `before_lookup` | `beforeLookup` |
| `perform_lookup` | `performLookup` |
| `transform_field` | `transformField` |
| `mask_field` | `maskField` |
| `unmask_field` | `unmaskField` |
| `before_insert` | `beforeInsert` |
| `after_insert` | `afterInsert` |

**Recommendation:** Use snake_case in YAML files for consistency with standard YAML conventions.

---

## Related Documentation

- [Getting Started](./getting-started.md) - Quick start guide
- [API Reference](./api-reference.md) - Full API documentation
- [SCHEMA.md](./SCHEMA.md) - JSON Schema for IDE auto-completion
- [Operation Modes](./operation-modes.md) - Entity operation restrictions
- [Role Permissions](./role-permissions.md) - Role-based access control
- [Integration Guide](./integration-guide.md) - Step-by-step integration
- [Architecture](../architecture.md) - System design overview

### Industry Examples

- [Financial Services](./industries/finance.md) - SOX, PCI-DSS compliance
- [Healthcare](./industries/healthcare.md) - HIPAA compliance
- [Oil & Gas](./industries/oil-gas.md) - High-volume sensor data
