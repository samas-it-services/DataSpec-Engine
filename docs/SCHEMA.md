# DataSpec JSON Schema

> Enable IDE auto-completion and validation for DataSpec YAML files.

---

## Target Audience

| Audience | What You'll Learn |
|----------|-------------------|
| **Developers** | IDE setup, schema validation |
| **DevOps** | CI/CD validation integration |

---

## Quick Setup

### Option 1: In-File Directive (Recommended)

Add this line at the top of your DataSpec YAML file:

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json
version: "1.0"
metadata:
  name: "my-spec"
  entity: "users"
# ... rest of your spec
```

This provides immediate auto-completion and validation.

### Option 2: VS Code Workspace Settings

Add to your project's `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json": [
      "**/dataspec/**/*.yaml",
      "**/dataspec/**/*.yml",
      "**/specs/**/*.yaml",
      "**/*-spec.yaml",
      "**/*-import.yaml",
      "**/*-export.yaml"
    ]
  }
}
```

### Option 3: Global VS Code Settings

Open VS Code settings (JSON) via `Ctrl/Cmd + Shift + P` > "Preferences: Open Settings (JSON)" and add:

```json
{
  "yaml.schemas": {
    "https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json": [
      "**/dataspec*.yaml",
      "**/*-spec.yaml"
    ]
  }
}
```

---

## Prerequisites

### VS Code Extension

Install the **YAML extension by Red Hat**:

1. Open VS Code Extensions (`Ctrl/Cmd + Shift + X`)
2. Search for "YAML"
3. Install "YAML" by Red Hat (identifier: `redhat.vscode-yaml`)

### JetBrains IDEs (IntelliJ, WebStorm)

JetBrains IDEs support JSON schemas natively:

1. Go to **Settings > Languages & Frameworks > Schemas and DTDs > JSON Schema Mappings**
2. Add a new mapping:
   - **Name**: DataSpec
   - **Schema URL**: `https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json`
   - **File path patterns**: `*-spec.yaml`, `dataspec/**/*.yaml`

---

## Schema Locations

The schema is available from multiple sources:

| Source | URL | Use Case |
|--------|-----|----------|
| jsDelivr CDN | `https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@latest/schema.json` | IDE integration (recommended) |
| npm package | `node_modules/@samas-it-services/dataspec-core/schema.json` | Local validation |
| GitHub Raw | `https://raw.githubusercontent.com/samas-it-services/DataSpec-Engine/main/packages/core/src/parser/schema.json` | Development |

### Specific Version

For pinned versions (recommended for production):

```yaml
# yaml-language-server: $schema=https://cdn.jsdelivr.net/npm/@samas-it-services/dataspec-core@0.2.0/schema.json
```

---

## Runtime Validation

### Using YAMLParser (Built-in)

The `YAMLParser` class automatically validates against the schema:

```typescript
import { YAMLParser, ValidationError } from '@samas-it-services/dataspec-core';

const parser = new YAMLParser();

try {
  const spec = parser.parse(yamlContent);
  console.log('Valid spec:', spec.metadata.name);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Schema validation failed:');
    error.errors.forEach(err => {
      console.error(`  - ${err.path}: ${err.message}`);
    });
  }
}
```

### Using AJV Directly

For custom validation workflows:

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as yaml from 'yaml';
import schema from '@samas-it-services/dataspec-core/schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);
const spec = yaml.parse(yamlContent);

if (!validate(spec)) {
  console.error('Validation errors:', validate.errors);
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate DataSpec Files

on:
  push:
    paths:
      - '**/*.yaml'
      - '**/*.yml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install @samas-it-services/dataspec-core ajv ajv-formats yaml

      - name: Validate specs
        run: |
          node -e "
            const Ajv = require('ajv');
            const addFormats = require('ajv-formats');
            const yaml = require('yaml');
            const fs = require('fs');
            const schema = require('@samas-it-services/dataspec-core/schema.json');

            const ajv = new Ajv({ allErrors: true });
            addFormats(ajv);
            const validate = ajv.compile(schema);

            const files = process.argv.slice(1);
            let hasErrors = false;

            for (const file of files) {
              const content = fs.readFileSync(file, 'utf8');
              const spec = yaml.parse(content);

              if (!validate(spec)) {
                console.error('Errors in', file + ':');
                validate.errors.forEach(e => console.error('  -', e.message));
                hasErrors = true;
              } else {
                console.log('Valid:', file);
              }
            }

            if (hasErrors) process.exit(1);
          " specs/**/*.yaml
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate DataSpec YAML files
npx ts-node scripts/validate-specs.ts
```

---

## What the Schema Validates

The schema enforces:

### Structure
- Required top-level properties: `version`, `metadata`, `database`, `columns`
- Proper nesting of all sections
- No additional/unknown properties (strict mode)

### Types
- `version` must match semver pattern (`1.0`, `1.2.3`)
- `sensitivity` must be one of: `public`, `internal`, `confidential`, `secret`, `highly_restricted`
- `type` must be one of: `string`, `text`, `integer`, `number`, `decimal`, `boolean`, `date`, `datetime`, `time`, `uuid`, `json`, `array`

### Validation Rules
- `regex` validation requires `pattern` property
- `enum` validation requires `values` array
- `custom` validation requires `script` property

### Transformations
- `parse_date` and `format_date` require `format`
- `regex_extract` and `regex_replace` require `pattern`
- `regex_replace` also requires `replacement`
- `split` and `join` require `delimiter`
- `custom` requires `script`

### Lookups
- Required: `table`, `key`, `fallback`
- `fallback` must be one of: `error`, `skip`, `default`, `null`

### Masking
- Required: `mode`
- `mode` must be one of: `full`, `partial`, `regex`, `custom`

---

## Troubleshooting

### Schema Not Loading

1. **Check VS Code YAML extension** is installed and enabled
2. **Verify network access** to cdn.jsdelivr.net
3. **Try local schema**:
   ```yaml
   # yaml-language-server: $schema=./node_modules/@samas-it-services/dataspec-core/schema.json
   ```

### Validation Errors Not Showing

1. Open VS Code Output panel (`Ctrl/Cmd + Shift + U`)
2. Select "YAML Support" from dropdown
3. Check for error messages

### False Positives

If the schema reports errors for valid specs:

1. Check you're using the latest schema version
2. Verify property naming (use `snake_case` in YAML)
3. Report issues at [GitHub Issues](https://github.com/samas-it-services/DataSpec-Engine/issues)

---

## Schema Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.2.0 | 2024-12 | Added descriptions, examples, masking `visible_chars`/`position`, lookup `return_field`/`cache_ttl` |
| 0.1.0 | 2024-11 | Initial release |

---

## Related Documentation

- [YAML Specification Guide](./yaml-spec-guide.md) - Complete YAML reference
- [API Reference](./api-reference.md) - Full API documentation
- [Getting Started](./getting-started.md) - Quick start guide
