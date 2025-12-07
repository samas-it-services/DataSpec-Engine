/**
 * YAMLParser Unit Tests
 */

import { YAMLParser, ParseError, ValidationError } from '../parser/YAMLParser';

describe('YAMLParser', () => {
  let parser: YAMLParser;

  const validYaml = `
version: "1.0"
metadata:
  name: TestSpec
  entity: users
  description: Test specification
  author: Test Author
  tags:
    - test
    - users
database:
  table: users
  primary_key: id
  schema: public
columns:
  - name: id
    source: id
    type: uuid
    required: true
    sensitivity: internal
  - name: email
    source: email
    type: string
    required: true
    sensitivity: confidential
    validation:
      - type: email
    masking:
      mode: full
  - name: name
    source: full_name
    type: string
    required: true
    sensitivity: public
    transform:
      - type: trim
      - type: capitalize
`;

  const specWithHooks = `
version: "1.0"
metadata:
  name: SpecWithHooks
  entity: products
database:
  table: products
  primary_key: id
columns:
  - name: id
    source: id
    type: uuid
    required: true
    sensitivity: internal
hooks:
  before_validate_row:
    - name: logRow
      script: "return { success: true };"
  validate_field:
    - name: validatePrice
      field: price
      script: "return { success: value > 0 };"
`;

  const specWithImportOptions = `
version: "1.0"
metadata:
  name: SpecWithOptions
  entity: orders
database:
  table: orders
  primary_key: id
columns:
  - name: id
    source: id
    type: uuid
    required: true
    sensitivity: internal
import_options:
  duplicate_strategy: update
  batch_size: 50
  validate_foreign_keys: true
  auto_generate_ids: true
export_options:
  apply_masking: true
  include_audit_fields: true
  format: csv
`;

  const specWithLookup = `
version: "1.0"
metadata:
  name: SpecWithLookup
  entity: transactions
database:
  table: transactions
  primary_key: id
columns:
  - name: id
    source: id
    type: uuid
    required: true
    sensitivity: internal
  - name: customer_id
    source: customer_name
    type: uuid
    required: false
    sensitivity: internal
    lookup:
      table: customers
      key: name
      source_field: customer_name
      fallback: "null"
      default_value: null
      cache: true
`;

  beforeEach(() => {
    parser = new YAMLParser();
  });

  describe('parse()', () => {
    it('should parse valid YAML', () => {
      const result = parser.parse(validYaml);

      expect(result.version).toBe('1.0');
      expect(result.metadata.name).toBe('TestSpec');
      expect(result.metadata.entity).toBe('users');
      expect(result.database.table).toBe('users');
      expect(result.database.primaryKey).toBe('id');
      expect(result.columns).toHaveLength(3);
    });

    it('should normalize snake_case to camelCase', () => {
      const result = parser.parse(validYaml);

      expect(result.database.primaryKey).toBe('id');
      expect(result.columns[0].sensitivity).toBe('internal');
    });

    it('should parse hooks configuration', () => {
      const result = parser.parse(specWithHooks);

      expect(result.hooks).toBeDefined();
      expect(result.hooks?.beforeValidateRow).toHaveLength(1);
      expect(result.hooks?.validateField).toHaveLength(1);
    });

    it('should parse import/export options', () => {
      const result = parser.parse(specWithImportOptions);

      expect(result.importOptions).toBeDefined();
      expect(result.importOptions?.duplicateStrategy).toBe('update');
      expect(result.importOptions?.batchSize).toBe(50);

      expect(result.exportOptions).toBeDefined();
      expect(result.exportOptions?.applyMasking).toBe(true);
      expect(result.exportOptions?.format).toBe('csv');
    });

    it('should parse lookup configuration', () => {
      const result = parser.parse(specWithLookup);

      const lookupColumn = result.columns.find(c => c.name === 'customer_id');
      expect(lookupColumn?.lookup).toBeDefined();
      expect(lookupColumn?.lookup?.table).toBe('customers');
      expect(lookupColumn?.lookup?.key).toBe('name');
      expect(lookupColumn?.lookup?.fallback).toBe('null');
    });

    it('should throw ParseError for invalid YAML syntax', () => {
      const invalidYaml = `
version: "1.0"
  invalid:
    - this is: broken
      yaml here
`;

      expect(() => parser.parse(invalidYaml)).toThrow(ParseError);
    });

    it('should throw ParseError for non-object YAML', () => {
      expect(() => parser.parse('just a string')).toThrow(ParseError);
      expect(() => parser.parse('null')).toThrow(ParseError);
    });

    it('should throw ValidationError for missing required fields', () => {
      const missingVersion = `
metadata:
  name: Test
  entity: test
database:
  table: test
  primary_key: id
columns:
  - name: id
    source: id
    type: string
    required: true
    sensitivity: public
`;

      expect(() => parser.parse(missingVersion)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid version format', () => {
      const invalidVersion = `
version: "invalid"
metadata:
  name: Test
  entity: test
database:
  table: test
  primary_key: id
columns:
  - name: id
    source: id
    type: string
    required: true
    sensitivity: public
`;

      expect(() => parser.parse(invalidVersion)).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty columns array', () => {
      const emptyColumns = `
version: "1.0"
metadata:
  name: Test
  entity: test
database:
  table: test
  primary_key: id
columns: []
`;

      expect(() => parser.parse(emptyColumns)).toThrow(ValidationError);
    });
  });

  describe('validateSpec()', () => {
    it('should validate a raw spec object with snake_case', () => {
      // validateSpec expects the raw format with snake_case
      const rawSpec = {
        version: '1.0',
        metadata: { name: 'Test', entity: 'test' },
        database: { table: 'test', primary_key: 'id' },
        columns: [{
          name: 'id',
          source: 'id',
          type: 'string',
          required: true,
          sensitivity: 'public'
        }]
      };

      expect(parser.validateSpec(rawSpec as any)).toBe(true);
    });

    it('should throw ValidationError for invalid spec', () => {
      const invalidSpec: any = {
        version: '1.0',
        metadata: { name: 'Test' }, // missing entity
        database: { table: 'test', primary_key: 'id' },
        columns: []
      };

      expect(() => parser.validateSpec(invalidSpec)).toThrow(ValidationError);
    });
  });

  describe('stringify()', () => {
    it('should convert spec back to YAML', () => {
      const spec = parser.parse(validYaml);
      const yamlOutput = parser.stringify(spec);

      expect(typeof yamlOutput).toBe('string');
      expect(yamlOutput).toContain('version:');
      expect(yamlOutput).toContain('metadata:');
      expect(yamlOutput).toContain('columns:');
    });

    it('should produce valid YAML output', () => {
      const spec = parser.parse(validYaml);
      const yamlOutput = parser.stringify(spec);

      // Check that the YAML output contains expected values
      expect(yamlOutput).toContain('TestSpec');
      expect(yamlOutput).toContain('users');
    });
  });

  describe('getErrorDetails()', () => {
    it('should format validation errors', () => {
      const errors = [
        { instancePath: '/metadata/entity', message: 'is required' },
        { instancePath: '/columns/0/type', message: 'must be one of enum values', params: { allowedValues: ['string', 'number'] } }
      ];

      const details = parser.getErrorDetails(errors);

      expect(details).toHaveLength(2);
      expect(details[0]).toContain('/metadata/entity');
      expect(details[0]).toContain('is required');
    });

    it('should handle errors without instancePath', () => {
      const errors = [{ message: 'root error' }];
      const details = parser.getErrorDetails(errors);

      expect(details[0]).toContain('root');
    });
  });

  describe('column transformations', () => {
    it('should parse transform array', () => {
      const result = parser.parse(validYaml);
      const nameColumn = result.columns.find(c => c.name === 'name');

      expect(nameColumn?.transform).toHaveLength(2);
      expect(nameColumn?.transform?.[0].type).toBe('trim');
      expect(nameColumn?.transform?.[1].type).toBe('capitalize');
    });

    it('should parse validation rules', () => {
      const result = parser.parse(validYaml);
      const emailColumn = result.columns.find(c => c.name === 'email');

      expect(emailColumn?.validation).toHaveLength(1);
      expect(emailColumn?.validation?.[0].type).toBe('email');
    });

    it('should parse masking config', () => {
      const result = parser.parse(validYaml);
      const emailColumn = result.columns.find(c => c.name === 'email');

      expect(emailColumn?.masking).toBeDefined();
      expect(emailColumn?.masking?.mode).toBe('full');
    });

    it('should parse masking config with partial settings', () => {
      const yamlWithPartialMask = `
version: "1.0"
metadata:
  name: Test
  entity: test
database:
  table: test
  primary_key: id
columns:
  - name: ssn
    source: ssn
    type: string
    required: true
    sensitivity: secret
    masking:
      mode: partial
      partial_start: 2
      partial_end: 4
      replacement: "#"
`;
      const result = parser.parse(yamlWithPartialMask);
      const ssnColumn = result.columns.find(c => c.name === 'ssn');

      expect(ssnColumn?.masking?.mode).toBe('partial');
      expect(ssnColumn?.masking?.partialStart).toBe(2);
      expect(ssnColumn?.masking?.partialEnd).toBe(4);
      expect(ssnColumn?.masking?.replacement).toBe('#');
    });
  });

  describe('metadata fields', () => {
    it('should parse optional metadata fields', () => {
      const result = parser.parse(validYaml);

      expect(result.metadata.description).toBe('Test specification');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.tags).toContain('test');
    });

    it('should parse metadata created_at as createdAt', () => {
      const yamlWithDate = `
version: "1.0"
metadata:
  name: Test
  entity: test
  created_at: "2023-12-25"
database:
  table: test
  primary_key: id
columns:
  - name: id
    source: id
    type: string
    required: true
    sensitivity: public
`;

      const result = parser.parse(yamlWithDate);
      expect(result.metadata.createdAt).toBe('2023-12-25');
    });
  });

  describe('database schema', () => {
    it('should parse optional schema field', () => {
      const result = parser.parse(validYaml);
      expect(result.database.schema).toBe('public');
    });
  });
});
