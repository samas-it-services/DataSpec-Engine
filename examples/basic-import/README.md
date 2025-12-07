# Basic Import Example

This example demonstrates how to use the `@dataspec-engine/core` package to import CSV data using a YAML specification.

## Overview

This example shows:
- Parsing a YAML import specification
- Loading and validating CSV data
- Transforming fields (trim, uppercase, date parsing)
- Previewing import results
- Executing a full import with a mock database adapter

## Files

```
basic-import/
├── README.md              # This file
├── package.json           # Dependencies
├── sample-data/
│   └── users.csv          # Sample CSV data
├── specs/
│   └── users-import.yaml  # YAML specification
└── src/
    └── index.ts           # Main example script
```

## Quick Start

```bash
# Install dependencies
npm install

# Run the example
npm start
```

## Sample Data

The `sample-data/users.csv` file contains:

```csv
first_name,last_name,email,date_of_birth,role,department
  John  ,  Doe  ,JOHN.DOE@EXAMPLE.COM,1990-05-15,admin,Engineering
Jane,Smith,jane.smith@example.com,1985-12-20,user,Marketing
Bob,Johnson,bob.j@company.org,invalid-date,user,Sales
Alice,Williams,alice.w@company.org,2000-01-01,manager,HR
```

Notice:
- Extra whitespace in names (will be trimmed)
- Uppercase email (will be lowercased)
- Invalid date format in row 3 (will fail validation)

## YAML Specification

The `specs/users-import.yaml` defines:

```yaml
version: "1.0"
metadata:
  entity: users
  name: User Import
  description: Import user data with transformations

columns:
  - name: first_name
    source: first_name
    type: string
    required: true
    transform:
      - type: trim
      - type: uppercase

  - name: last_name
    source: last_name
    type: string
    required: true
    transform:
      - type: trim

  - name: email
    source: email
    type: string
    required: true
    transform:
      - type: trim
      - type: lowercase
    validation:
      - type: pattern
        value: "^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$"

  - name: date_of_birth
    source: date_of_birth
    type: date
    required: false
    transform:
      - type: parse_date
        format: YYYY-MM-DD

  - name: role
    source: role
    type: string
    required: true
    default: user

  - name: department
    source: department
    type: string
    required: false
```

## Expected Output

When you run the example, you'll see:

1. **Preview Results** - Shows transformed data and validation errors
2. **Summary** - Total rows, valid rows, invalid rows
3. **Validation Errors** - Details of any rows that failed validation

```
=== DataSpec Engine - Basic Import Example ===

Parsing YAML specification...
✓ Specification parsed successfully

Loading CSV file...
✓ Loaded 4 rows from CSV

=== PREVIEW MODE ===

Previewing import...

Preview Results:
┌─────────────┬────────────┬─────────────────────────┬────────────┬─────────┬─────────────┐
│ first_name  │ last_name  │ email                   │ dob        │ role    │ department  │
├─────────────┼────────────┼─────────────────────────┼────────────┼─────────┼─────────────┤
│ JOHN        │ Doe        │ john.doe@example.com    │ 1990-05-15 │ admin   │ Engineering │
│ JANE        │ Smith      │ jane.smith@example.com  │ 1985-12-20 │ user    │ Marketing   │
│ BOB         │ Johnson    │ bob.j@company.org       │ [ERROR]    │ user    │ Sales       │
│ ALICE       │ Williams   │ alice.w@company.org     │ 2000-01-01 │ manager │ HR          │
└─────────────┴────────────┴─────────────────────────┴────────────┴─────────┴─────────────┘

Summary:
- Total rows: 4
- Valid rows: 3
- Invalid rows: 1

Validation Errors:
- Row 3: Invalid date format for date_of_birth: "invalid-date"
```

## Code Walkthrough

### 1. Import the Core Package

```typescript
import {
  YAMLParser,
  ImportExecutor,
  FieldTransformer,
} from '@dataspec-engine/core';
```

### 2. Parse the YAML Specification

```typescript
const parser = new YAMLParser();
const spec = await parser.parse(yamlContent);
```

### 3. Create an Import Executor

```typescript
const executor = new ImportExecutor({
  spec,
  adapter: mockAdapter,  // Database adapter
  transformer: new FieldTransformer(),
});
```

### 4. Preview the Import

```typescript
const preview = await executor.preview(csvData, { maxRows: 100 });

console.log('Valid rows:', preview.validRows);
console.log('Invalid rows:', preview.invalidRows);
console.log('Errors:', preview.errors);
```

### 5. Execute the Import

```typescript
const result = await executor.execute(csvData);

console.log('Inserted:', result.inserted);
console.log('Updated:', result.updated);
console.log('Skipped:', result.skipped);
```

## Next Steps

- See the [full-stack-demo](../full-stack-demo) for a complete React + API example
- See the [supabase-demo](../supabase-demo) for Supabase Edge Functions integration
- Read the [YAML Spec Guide](../../docs/yaml-spec-guide.md) for all specification options
