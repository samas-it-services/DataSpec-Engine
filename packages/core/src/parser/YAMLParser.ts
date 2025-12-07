/**
 * YAML Parser
 *
 * Parses YAML specification files and validates them against JSON Schema
 */

import * as YAML from 'yaml';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { DataSpecDefinition } from '../types/spec.types';
import * as schema from './schema.json';

/**
 * Parse error class
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public errors?: any[]
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: any[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * YAML Parser class
 */
export class YAMLParser {
  private ajv: Ajv;
  private validate: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });

    addFormats(this.ajv);

    this.validate = this.ajv.compile(schema);
  }

  /**
   * Parse YAML string into DataSpecDefinition
   *
   * @param yamlContent - YAML content as string
   * @returns Parsed and validated DataSpecDefinition
   * @throws ParseError if YAML parsing fails
   * @throws ValidationError if schema validation fails
   */
  parse(yamlContent: string): DataSpecDefinition {
    let parsed: any;

    try {
      parsed = YAML.parse(yamlContent);
    } catch (error: any) {
      throw new ParseError(`Failed to parse YAML: ${error.message}`, [error]);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new ParseError('Invalid YAML: root must be an object');
    }

    const isValid = this.validate(parsed);

    if (!isValid) {
      const errors = this.validate.errors || [];
      const errorMessages = errors.map(err => {
        const path = err.instancePath || 'root';
        return `${path}: ${err.message}`;
      });

      throw new ValidationError(
        `Schema validation failed:\n${errorMessages.join('\n')}`,
        errors
      );
    }

    return this.normalizeSpec(parsed as DataSpecDefinition);
  }

  /**
   * Parse YAML file from path
   *
   * @param filePath - Path to YAML file
   * @returns Parsed and validated DataSpecDefinition
   */
  async parseFile(filePath: string): Promise<DataSpecDefinition> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Stringify DataSpecDefinition to YAML
   *
   * @param spec - DataSpecDefinition to convert
   * @returns YAML string
   */
  stringify(spec: DataSpecDefinition): string {
    return YAML.stringify(spec, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0
    });
  }

  /**
   * Validate a DataSpecDefinition object against schema
   *
   * @param spec - Spec object to validate
   * @returns True if valid
   * @throws ValidationError if validation fails
   */
  validateSpec(spec: DataSpecDefinition): boolean {
    const isValid = this.validate(spec);

    if (!isValid) {
      const errors = this.validate.errors || [];
      const errorMessages = errors.map(err => {
        const path = err.instancePath || 'root';
        return `${path}: ${err.message}`;
      });

      throw new ValidationError(
        `Schema validation failed:\n${errorMessages.join('\n')}`,
        errors
      );
    }

    return true;
  }

  /**
   * Normalize spec by filling in defaults and converting snake_case to camelCase
   *
   * @param spec - Raw spec from YAML
   * @returns Normalized spec
   */
  private normalizeSpec(spec: any): DataSpecDefinition {
    const normalized: DataSpecDefinition = {
      version: spec.version,
      metadata: {
        name: spec.metadata.name,
        description: spec.metadata.description,
        entity: spec.metadata.entity,
        author: spec.metadata.author,
        createdAt: spec.metadata.created_at || spec.metadata.createdAt,
        tags: spec.metadata.tags,
        version: spec.metadata.version
      },
      database: {
        table: spec.database.table,
        primaryKey: spec.database.primary_key || spec.database.primaryKey,
        schema: spec.database.schema
      },
      columns: spec.columns.map((col: any) => this.normalizeColumn(col)),
      hooks: spec.hooks ? this.normalizeHooks(spec.hooks) : undefined,
      importOptions: spec.import_options ? {
        duplicateStrategy: spec.import_options.duplicate_strategy || spec.import_options.duplicateStrategy || 'skip',
        batchSize: spec.import_options.batch_size || spec.import_options.batchSize || 100,
        validateForeignKeys: spec.import_options.validate_foreign_keys ?? spec.import_options.validateForeignKeys ?? true,
        autoGenerateIds: spec.import_options.auto_generate_ids ?? spec.import_options.autoGenerateIds ?? false
      } : undefined,
      exportOptions: spec.export_options ? {
        applyMasking: spec.export_options.apply_masking ?? spec.export_options.applyMasking ?? true,
        includeAuditFields: spec.export_options.include_audit_fields ?? spec.export_options.includeAuditFields ?? false,
        format: spec.export_options.format || 'csv'
      } : undefined
    };

    return normalized;
  }

  /**
   * Normalize a column definition
   */
  private normalizeColumn(col: any): any {
    const normalized: any = {
      name: col.name,
      source: col.source,
      type: col.type,
      required: col.required,
      sensitivity: col.sensitivity,
      validation: col.validation,
      transform: col.transform,
      masking: col.masking,
      unmaskPermissions: col.unmask_permissions || col.unmaskPermissions,
      lookup: col.lookup,
      default: col.default
    };

    if (normalized.lookup) {
      normalized.lookup = {
        table: normalized.lookup.table,
        key: normalized.lookup.key,
        sourceField: normalized.lookup.source_field || normalized.lookup.sourceField,
        fallback: normalized.lookup.fallback,
        defaultValue: normalized.lookup.default_value || normalized.lookup.defaultValue,
        cache: normalized.lookup.cache
      };
    }

    if (normalized.masking) {
      normalized.masking = {
        mode: normalized.masking.mode,
        replacement: normalized.masking.replacement,
        partialStart: normalized.masking.partial_start || normalized.masking.partialStart,
        partialEnd: normalized.masking.partial_end || normalized.masking.partialEnd,
        regexPattern: normalized.masking.regex_pattern || normalized.masking.regexPattern,
        customScript: normalized.masking.custom_script || normalized.masking.customScript
      };
    }

    return normalized;
  }

  /**
   * Normalize hooks configuration
   */
  private normalizeHooks(hooks: any): any {
    return {
      beforeValidateRow: hooks.before_validate_row || hooks.beforeValidateRow,
      validateField: hooks.validate_field || hooks.validateField,
      beforeLookup: hooks.before_lookup || hooks.beforeLookup,
      performLookup: hooks.perform_lookup || hooks.performLookup,
      transformField: hooks.transform_field || hooks.transformField,
      maskField: hooks.mask_field || hooks.maskField,
      unmaskField: hooks.unmask_field || hooks.unmaskField,
      beforeInsert: hooks.before_insert || hooks.beforeInsert,
      afterInsert: hooks.after_insert || hooks.afterInsert
    };
  }

  /**
   * Get detailed error information from validation errors
   *
   * @param errors - Validation errors from AJV
   * @returns Formatted error messages
   */
  getErrorDetails(errors: any[]): string[] {
    return errors.map(err => {
      const path = err.instancePath || 'root';
      const message = err.message || 'validation failed';
      const params = err.params ? JSON.stringify(err.params) : '';

      return `${path}: ${message}${params ? ` (${params})` : ''}`;
    });
  }
}

export default YAMLParser;
