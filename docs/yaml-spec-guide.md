# DataSpec Engine - YAML Specification Guide

Complete guide to writing YAML specifications for DataSpec Engine.

---

## Table of Contents

- [Basic Structure](#basic-structure)
- [Metadata Section](#metadata-section)
- [Database Section](#database-section)
- [Columns Section](#columns-section)
- [Validation Rules](#validation-rules)
- [Transformations](#transformations)
- [Lookups](#lookups)
- [Sensitivity & Masking](#sensitivity--masking)
- [Hooks](#hooks)
- [Import Options](#import-options)
- [Export Options](#export-options)
- [Complete Examples](#complete-examples)

---

## Basic Structure

```yaml
version: "1.0"

metadata:
  name: "spec-name"
  description: "Description"
  entity: "entity_name"
  author: "author@example.com"
  created_at: "2024-01-01"
  tags: ["tag1", "tag2"]

database:
  table: "table_name"
  primary_key: "id"

columns:
  - name: "column_name"
    source: "CSV Header"
    type: "string"
    required: true

hooks:
  before_validate_row:
    - name: "hook_name"
      script: |
        // JavaScript code

import_options:
  duplicate_strategy: "skip"
  batch_size: 100

export_options:
  apply_masking: true
  format: "csv"
```

---

## Metadata Section

```yaml
metadata:
  # Required
  name: "transactions-import-v2"    # Unique identifier
  entity: "transactions"            # Target entity type

  # Optional
  description: "Import financial transactions from bank exports"
  author: "finance-team@company.com"
  created_at: "2024-01-15"
  tags:
    - "finance"
    - "transactions"
    - "bank-import"
  deprecated: false                 # Mark spec as deprecated
  deprecation_notice: "Use v3 instead"
```

---

## Database Section

```yaml
database:
  # Required
  table: "transactions"            # Target database table
  primary_key: "id"                # Primary key column

  # Optional
  schema: "public"                 # Database schema
  connection: "default"            # Named connection (for multi-DB)
```

---

## Columns Section

### Basic Column Definition

```yaml
columns:
  - name: "id"                     # Database column name
    source: "Transaction ID"       # CSV header name
    type: "uuid"                   # Data type
    required: true                 # Is required?
```

### Supported Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"Hello"` |
| `text` | Long text | Multi-line content |
| `uuid` | UUID format | `"550e8400-e29b-41d4-a716-446655440000"` |
| `integer` | Whole number | `42` |
| `decimal` | Decimal number | `123.45` |
| `boolean` | True/false | `true`, `false` |
| `date` | Date only | `"2024-01-15"` |
| `datetime` | Date and time | `"2024-01-15T10:30:00Z"` |
| `json` | JSON object | `{"key": "value"}` |
| `array` | Array values | `["a", "b", "c"]` |

### Complete Column Example

```yaml
columns:
  - name: "amount"
    source: "Transaction Amount"
    type: "decimal"
    required: true
    sensitivity: "confidential"
    validation:
      - type: "range"
        min: 0
        max: 1000000
    transform:
      - type: "round"
        decimals: 2
    masking:
      mode: "partial"
      visible_chars: 2
    default: 0
```

---

## Validation Rules

### Available Validators

```yaml
validation:
  # Required field
  - type: "required"

  # Type validation
  - type: "uuid"
  - type: "email"
  - type: "url"
  - type: "phone"

  # String constraints
  - type: "min_length"
    value: 3
  - type: "max_length"
    value: 100
  - type: "pattern"
    regex: "^[A-Z]{2}[0-9]{6}$"

  # Numeric constraints
  - type: "range"
    min: 0
    max: 1000000
  - type: "positive"
  - type: "negative"

  # Enum validation
  - type: "enum"
    values: ["active", "inactive", "pending"]

  # Date validation
  - type: "date_range"
    min: "2020-01-01"
    max: "2030-12-31"
  - type: "future_date"
  - type: "past_date"

  # Custom validation
  - type: "custom"
    script: |
      if (value.startsWith('INVALID')) {
        throw new Error('Value cannot start with INVALID');
      }
```

### Validation with Error Messages

```yaml
validation:
  - type: "range"
    min: 0
    max: 100
    message: "Value must be between 0 and 100"
  - type: "pattern"
    regex: "^[A-Z0-9]+$"
    message: "Only uppercase letters and numbers allowed"
```

---

## Transformations

### Available Transformations

```yaml
transform:
  # String transformations
  - type: "trim"                   # Remove whitespace
  - type: "uppercase"              # Convert to uppercase
  - type: "lowercase"              # Convert to lowercase

  # Parsing
  - type: "parse_date"
    format: "YYYY-MM-DD"           # Date format
  - type: "parse_number"           # Parse string to number
  - type: "parse_boolean"          # Parse to boolean

  # Numeric
  - type: "round"
    decimals: 2                    # Round to decimals

  # Extraction
  - type: "regex_extract"
    pattern: "Invoice #([0-9]+)"   # Regex pattern
    group: 1                       # Capture group
    target_field: "invoice_id"    # Optional: store in different field

  # Replacement
  - type: "replace"
    search: "old_value"
    replace: "new_value"
    all: true                      # Replace all occurrences

  # Default values
  - type: "default"
    value: "N/A"                   # Default if null/empty

  # Concatenation
  - type: "concat"
    fields: ["first_name", "last_name"]
    separator: " "

  # Custom transformation
  - type: "custom"
    script: |
      return value.split('-').reverse().join('/');
```

### Chained Transformations

```yaml
transform:
  - type: "trim"
  - type: "uppercase"
  - type: "replace"
    search: " "
    replace: "_"
```

---

## Lookups

### Single Key Lookup

```yaml
columns:
  - name: "customer_id"
    source: "Customer Email"
    type: "uuid"
    lookup:
      table: "customers"
      key: "email"                 # Lookup by email
      return_field: "id"           # Return customer ID
      fallback: "error"            # What to do if not found
```

### Composite Key Lookup

```yaml
columns:
  - name: "product_variant_id"
    source: "Product Code"
    type: "uuid"
    lookup:
      table: "product_variants"
      keys:
        - field: "product_code"
          source: "Product Code"
        - field: "size"
          source: "Size"
        - field: "color"
          source: "Color"
      return_field: "id"
      fallback: "skip"
```

### Fallback Strategies

```yaml
lookup:
  table: "users"
  key: "email"
  fallback: "error"        # Throw error if not found
  # OR
  fallback: "skip"         # Skip the row
  # OR
  fallback: "default"      # Use default value
  default_value: null
```

### Lookup with Cache

```yaml
lookup:
  table: "categories"
  key: "name"
  cache: true              # Enable caching
  cache_ttl: 3600          # Cache TTL in seconds
```

---

## Sensitivity & Masking

### Sensitivity Levels

```yaml
columns:
  - name: "ssn"
    source: "Social Security Number"
    type: "string"
    sensitivity: "highly_restricted"  # Highest level
```

| Level | Description | Default Masking |
|-------|-------------|-----------------|
| `public` | No restrictions | None |
| `internal` | Internal use only | Partial |
| `confidential` | Business sensitive | Full |
| `secret` | Highly sensitive + audit | Full |
| `highly_restricted` | Maximum protection | Full + special permissions |

### Masking Configuration

```yaml
columns:
  - name: "credit_card"
    source: "Card Number"
    type: "string"
    sensitivity: "secret"
    masking:
      mode: "partial"              # Masking mode
      visible_chars: 4             # Show last 4 chars
      replacement: "*"             # Mask character
```

### Masking Modes

```yaml
# Full masking
masking:
  mode: "full"
  replacement: "***MASKED***"

# Partial masking (show first/last characters)
masking:
  mode: "partial"
  visible_chars: 4
  position: "end"                  # "start" or "end"
  replacement: "*"

# Regex-based masking
masking:
  mode: "regex"
  pattern: "([0-9]{4})-[0-9]{4}-[0-9]{4}-([0-9]{4})"
  replacement: "$1-****-****-$2"

# Custom masking
masking:
  mode: "custom"
  script: |
    const parts = value.split('@');
    return parts[0].substring(0, 2) + '***@' + parts[1];
```

### Unmask Permissions

```yaml
columns:
  - name: "bank_account"
    source: "Account Number"
    sensitivity: "secret"
    masking:
      mode: "full"
    unmask_permissions:
      - "super_admin"
      - "finance_manager"
    unmask_requires_reason: true   # Require reason for unmask
```

---

## Hooks

### Hook Points

```yaml
hooks:
  # Before row validation
  before_validate_row:
    - name: "normalize_data"
      script: |
        row.email = row.email.toLowerCase();
        row.phone = row.phone.replace(/[^0-9]/g, '');
        return row;

  # Field-specific validation
  validate_field:
    - name: "validate_amount"
      field: "amount"              # Specific field
      script: |
        if (value < 0) {
          throw new ValidationError('Amount must be positive');
        }
        return value;

  # Before lookup
  before_lookup:
    - name: "prepare_lookup_key"
      script: |
        context.lookupKey = context.lookupKey.trim().toUpperCase();
        return context;

  # Custom lookup
  perform_lookup:
    - name: "custom_lookup"
      script: |
        // Custom lookup logic
        const result = await context.adapter.query(
          'SELECT id FROM users WHERE LOWER(email) = $1',
          [value.toLowerCase()]
        );
        return result[0]?.id || null;

  # Field transformation
  transform_field:
    - name: "custom_transform"
      field: "description"
      script: |
        return value.replace(/\n/g, ' ').trim();

  # Before database insert
  before_insert:
    - name: "add_audit_fields"
      script: |
        row.created_at = new Date();
        row.created_by = context.userId;
        row.import_batch_id = context.batchId;
        return row;

  # After database insert
  after_insert:
    - name: "post_insert_notification"
      script: |
        if (row.amount > 10000) {
          await context.notify('large_transaction', row);
        }
```

### Hook Context

```javascript
// Available in all hooks
context = {
  userId: string,          // Current user ID
  userRoles: string[],     // User's roles
  batchId: string,         // Import batch ID
  rowIndex: number,        // Current row index
  totalRows: number,       // Total rows being processed
  spec: DataSpecDefinition, // Full spec definition
  adapter: DatabaseAdapter, // Database adapter
  logger: Logger,          // Logger instance
}
```

---

## Import Options

```yaml
import_options:
  # Duplicate handling
  duplicate_strategy: "skip"       # "skip" | "update" | "error"
  duplicate_key: ["email"]         # Fields to check for duplicates

  # Batch processing
  batch_size: 100                  # Rows per batch

  # Validation
  validate_foreign_keys: true      # Validate all lookups exist
  stop_on_error: false             # Stop on first error
  max_errors: 100                  # Max errors before stopping

  # ID generation
  auto_generate_ids: true          # Auto-generate UUIDs
  id_field: "id"                   # Field for auto-generated ID

  # Audit
  enable_audit_log: true           # Log all operations
  audit_fields:                    # Auto-populate audit fields
    created_at: true
    created_by: true
    import_batch_id: true
```

---

## Export Options

```yaml
export_options:
  # Format
  format: "csv"                    # "csv" | "json" | "xlsx"

  # Masking
  apply_masking: true              # Apply sensitivity masking
  mask_level: "internal"           # Minimum level to mask

  # Content
  include_headers: true            # Include column headers
  include_audit_fields: false      # Include created_at, etc.

  # Filtering
  default_filters:
    status: "active"
    deleted_at: null

  # Field selection
  include_fields:                  # Fields to include (whitelist)
    - "id"
    - "name"
    - "email"
  exclude_fields:                  # Fields to exclude (blacklist)
    - "password_hash"
    - "internal_notes"

  # Formatting
  date_format: "YYYY-MM-DD"
  decimal_precision: 2
  null_value: ""                   # How to represent nulls
```

---

## Complete Examples

### Transaction Import Spec

```yaml
version: "1.0"

metadata:
  name: "bank-transactions-import"
  description: "Import bank transaction data with account masking"
  entity: "transactions"
  author: "finance@company.com"
  tags: ["finance", "bank", "transactions"]

database:
  table: "transactions"
  primary_key: "id"

columns:
  - name: "id"
    source: "Transaction ID"
    type: "uuid"
    required: true
    validation:
      - type: "uuid"

  - name: "date"
    source: "Transaction Date"
    type: "date"
    required: true
    transform:
      - type: "parse_date"
        format: "MM/DD/YYYY"
    validation:
      - type: "past_date"

  - name: "amount"
    source: "Amount"
    type: "decimal"
    required: true
    sensitivity: "confidential"
    transform:
      - type: "parse_number"
      - type: "round"
        decimals: 2
    validation:
      - type: "range"
        min: -1000000
        max: 1000000

  - name: "description"
    source: "Description"
    type: "text"
    transform:
      - type: "trim"

  - name: "account_id"
    source: "Account Number"
    type: "uuid"
    sensitivity: "secret"
    lookup:
      table: "bank_accounts"
      key: "account_number"
      return_field: "id"
      fallback: "error"
    masking:
      mode: "partial"
      visible_chars: 4
    unmask_permissions:
      - "finance_admin"

  - name: "category"
    source: "Category"
    type: "string"
    transform:
      - type: "lowercase"
    validation:
      - type: "enum"
        values: ["income", "expense", "transfer"]
    default: "expense"

hooks:
  before_validate_row:
    - name: "normalize_amount"
      script: |
        // Convert negative amounts for expenses
        if (row.category === 'expense' && row.amount > 0) {
          row.amount = -row.amount;
        }
        return row;

  before_insert:
    - name: "add_audit"
      script: |
        row.imported_at = new Date();
        row.import_batch = context.batchId;
        return row;

import_options:
  duplicate_strategy: "skip"
  duplicate_key: ["account_id", "date", "amount", "description"]
  batch_size: 100
  validate_foreign_keys: true

export_options:
  apply_masking: true
  format: "csv"
  include_headers: true
```

### User Import Spec

```yaml
version: "1.0"

metadata:
  name: "user-import"
  description: "Import user data with email normalization"
  entity: "users"

database:
  table: "users"
  primary_key: "id"

columns:
  - name: "id"
    source: "User ID"
    type: "uuid"
    required: false
    # Will be auto-generated if not provided

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
      - type: "max_length"
        value: 255

  - name: "full_name"
    source: "Full Name"
    type: "string"
    required: true
    transform:
      - type: "trim"

  - name: "phone"
    source: "Phone Number"
    type: "string"
    sensitivity: "confidential"
    transform:
      - type: "custom"
        script: |
          return value.replace(/[^0-9+]/g, '');
    validation:
      - type: "phone"
    masking:
      mode: "partial"
      visible_chars: 4

  - name: "department_id"
    source: "Department"
    type: "uuid"
    lookup:
      table: "departments"
      key: "name"
      return_field: "id"
      fallback: "default"
      default_value: null

  - name: "role"
    source: "Role"
    type: "string"
    transform:
      - type: "lowercase"
    validation:
      - type: "enum"
        values: ["admin", "manager", "user", "guest"]
    default: "user"

import_options:
  duplicate_strategy: "update"
  duplicate_key: ["email"]
  auto_generate_ids: true
  batch_size: 50

export_options:
  apply_masking: true
  exclude_fields:
    - "password_hash"
    - "mfa_secret"
```

---

## Related Documentation

- [Getting Started](./getting-started.md)
- [API Reference](./api-reference.md)
- [Architecture](../architecture.md)
