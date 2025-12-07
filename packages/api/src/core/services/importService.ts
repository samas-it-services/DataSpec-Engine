import {
  PreviewResult,
  PreviewRow,
  ColumnInfo,
  FieldError,
  ImportResult,
  ImportError,
  DatabaseAdapter,
  NotFoundException,
  ValidationException,
  InternalServerException,
  SensitivityLevel,
  AuthUser,
} from '../types';
import { SpecService } from './specService';

export interface ImportServiceDependencies {
  db: DatabaseAdapter;
  specService: SpecService;
}

interface ParsedCSVRow {
  [key: string]: string;
}

interface ColumnDefinition {
  name: string;
  source: string;
  type: string;
  required: boolean;
  sensitivity?: SensitivityLevel;
  validation?: Array<{ type: string; value?: unknown; message?: string }>;
  transform?: Array<{ type: string; [key: string]: unknown }>;
  lookup?: {
    table: string;
    key: string | string[];
    return: string;
    fallback?: 'error' | 'skip' | 'default';
    defaultValue?: unknown;
  };
  masking?: {
    mode: string;
    visibleChars?: number;
  };
  default?: unknown;
}

interface ParsedSpec {
  database: { table: string };
  columns: ColumnDefinition[];
  importOptions?: {
    batchSize?: number;
    skipHeader?: boolean;
    delimiter?: string;
  };
}

export class ImportService {
  private db: DatabaseAdapter;
  private specService: SpecService;

  constructor(deps: ImportServiceDependencies) {
    this.db = deps.db;
    this.specService = deps.specService;
  }

  /**
   * Generate a preview of the import without writing to database
   */
  async preview(
    specId: string,
    fileContent: string,
    fileName: string,
    maxRows: number = 200,
    _user?: AuthUser
  ): Promise<PreviewResult> {
    try {
      // Get spec definition
      const spec = await this.specService.getSpecById(specId);
      if (!spec.yamlContent) {
        throw new ValidationException('Spec has no YAML content');
      }

      // Parse YAML spec
      const parsedSpec = this.specService.parseYaml(spec.yamlContent) as unknown as ParsedSpec;

      // Parse CSV content
      const rows = this.parseCSV(fileContent, fileName);
      const previewRows = rows.slice(0, maxRows);

      // Build column info
      const columns = this.buildColumnInfo(parsedSpec.columns);

      // Process each row
      const processedRows: PreviewRow[] = [];
      const allErrors: FieldError[] = [];

      for (let i = 0; i < previewRows.length; i++) {
        const row = previewRows[i];
        const { data, errors } = this.processRow(row, parsedSpec.columns, i);

        processedRows.push({
          rowIndex: i,
          data,
          errors,
          isValid: errors.length === 0,
        });

        allErrors.push(...errors);
      }

      const validRows = processedRows.filter((r) => r.isValid).length;
      const invalidRows = processedRows.filter((r) => !r.isValid).length;

      return {
        rows: processedRows,
        totalRows: rows.length,
        validRows,
        invalidRows,
        errors: processedRows
          .filter((r) => !r.isValid)
          .map((r) => ({
            rowIndex: r.rowIndex,
            errors: r.errors,
          })),
        columns,
        warnings: rows.length > maxRows ? [`Only showing ${maxRows} of ${rows.length} rows`] : [],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ValidationException
      ) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute the full import to database
   */
  async execute(
    specId: string,
    fileContent: string,
    fileName: string,
    batchSize: number = 100,
    skipValidation: boolean = false,
    _user?: AuthUser
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    let successfulRows = 0;
    let failedRows = 0;
    let skippedRows = 0;

    try {
      // Get spec definition
      const spec = await this.specService.getSpecById(specId);
      if (!spec.yamlContent) {
        throw new ValidationException('Spec has no YAML content');
      }

      // Parse YAML spec
      const parsedSpec = this.specService.parseYaml(spec.yamlContent) as unknown as ParsedSpec;
      const tableName = parsedSpec.database.table;

      // Parse CSV content
      const rows = this.parseCSV(fileContent, fileName);

      // Process in batches
      const batches = this.createBatches(rows, batchSize);

      for (const batch of batches) {
        const batchData: Record<string, unknown>[] = [];

        for (let i = 0; i < batch.rows.length; i++) {
          const row = batch.rows[i];
          const rowIndex = batch.startIndex + i;

          const { data, errors: rowErrors } = this.processRow(
            row,
            parsedSpec.columns,
            rowIndex
          );

          if (rowErrors.length > 0 && !skipValidation) {
            failedRows++;
            errors.push(
              ...rowErrors.map((e) => ({
                rowIndex,
                field: e.field,
                message: e.message,
                code: e.code,
                data: row,
              }))
            );
            continue;
          }

          // Resolve lookups
          try {
            const resolvedData = await this.resolveLookups(data, parsedSpec.columns);
            batchData.push(resolvedData);
          } catch (lookupError) {
            failedRows++;
            errors.push({
              rowIndex,
              message:
                lookupError instanceof Error
                  ? lookupError.message
                  : 'Lookup failed',
              code: 'LOOKUP_ERROR',
              data: row,
            });
          }
        }

        // Insert batch
        if (batchData.length > 0) {
          try {
            const result = await this.db.insert(tableName, batchData);
            if (result.success) {
              successfulRows += result.insertedCount;
            } else {
              failedRows += batchData.length;
              if (result.errors) {
                errors.push(
                  ...result.errors.map((e) => ({
                    rowIndex: batch.startIndex + e.index,
                    message: e.error,
                    code: 'INSERT_ERROR',
                  }))
                );
              }
            }
          } catch (insertError) {
            failedRows += batchData.length;
            errors.push({
              rowIndex: batch.startIndex,
              message:
                insertError instanceof Error
                  ? insertError.message
                  : 'Batch insert failed',
              code: 'BATCH_INSERT_ERROR',
            });
          }
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: failedRows === 0,
        totalRows: rows.length,
        successfulRows,
        failedRows,
        skippedRows,
        errors,
        duration,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ValidationException
      ) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to execute import: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse CSV content into rows
   */
  private parseCSV(content: string, fileName: string): ParsedCSVRow[] {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension !== 'csv') {
      throw new ValidationException(`Unsupported file format: ${extension}`);
    }

    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      throw new ValidationException('CSV file must have at least a header and one data row');
    }

    const headers = this.parseCSVLine(lines[0]);
    const rows: ParsedCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: ParsedCSVRow = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      rows.push(row);
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Build column info for preview
   */
  private buildColumnInfo(columns: ColumnDefinition[]): ColumnInfo[] {
    return columns.map((col) => ({
      name: col.name,
      sourceColumn: col.source,
      type: col.type,
      required: col.required,
      sensitivity: col.sensitivity,
      isMasked: !!col.masking,
    }));
  }

  /**
   * Process a single row
   */
  private processRow(
    row: ParsedCSVRow,
    columns: ColumnDefinition[],
    _rowIndex: number
  ): { data: Record<string, unknown>; errors: FieldError[] } {
    const data: Record<string, unknown> = {};
    const errors: FieldError[] = [];

    for (const col of columns) {
      const sourceValue = row[col.source];
      let value: unknown = sourceValue;

      // Check required
      if (col.required && (sourceValue === undefined || sourceValue === '')) {
        errors.push({
          field: col.name,
          message: `Field ${col.name} is required`,
          code: 'REQUIRED_FIELD',
          value: sourceValue,
        });
        continue;
      }

      // Apply default if empty
      if ((sourceValue === undefined || sourceValue === '') && col.default !== undefined) {
        value = col.default;
      }

      // Apply transformations
      if (col.transform && value !== undefined) {
        try {
          value = this.applyTransforms(value as string, col.transform);
        } catch (transformError) {
          errors.push({
            field: col.name,
            message: `Transform failed: ${transformError instanceof Error ? transformError.message : 'Unknown error'}`,
            code: 'TRANSFORM_ERROR',
            value: sourceValue,
          });
          continue;
        }
      }

      // Type conversion
      try {
        value = this.convertType(value as string, col.type);
      } catch (typeError) {
        errors.push({
          field: col.name,
          message: `Type conversion failed: ${typeError instanceof Error ? typeError.message : 'Unknown error'}`,
          code: 'TYPE_ERROR',
          value: sourceValue,
        });
        continue;
      }

      // Validation
      if (col.validation) {
        const validationErrors = this.validateField(value, col.validation, col.name);
        if (validationErrors.length > 0) {
          errors.push(...validationErrors);
          continue;
        }
      }

      data[col.name] = value;
    }

    return { data, errors };
  }

  /**
   * Apply transformations to a value
   */
  private applyTransforms(
    value: string,
    transforms: Array<{ type: string; [key: string]: unknown }>
  ): unknown {
    let result: unknown = value;

    for (const transform of transforms) {
      switch (transform.type.toLowerCase()) {
        case 'trim':
          result = String(result).trim();
          break;
        case 'uppercase':
          result = String(result).toUpperCase();
          break;
        case 'lowercase':
          result = String(result).toLowerCase();
          break;
        case 'replace':
          result = String(result).replace(
            new RegExp(transform.search as string, 'g'),
            transform.replace as string
          );
          break;
        case 'regex_extract':
          const match = String(result).match(new RegExp(transform.pattern as string));
          result = match ? match[transform.group as number || 0] : result;
          break;
        case 'default':
          if (result === '' || result === undefined || result === null) {
            result = transform.value;
          }
          break;
        default:
          // Unknown transform, skip
          break;
      }
    }

    return result;
  }

  /**
   * Convert value to target type
   */
  private convertType(value: string, type: string): unknown {
    if (value === '' || value === undefined || value === null) {
      return null;
    }

    switch (type.toLowerCase()) {
      case 'string':
        return String(value);
      case 'number':
      case 'integer':
        const num = type === 'integer' ? parseInt(value, 10) : parseFloat(value);
        if (isNaN(num)) {
          throw new Error(`Invalid ${type}: ${value}`);
        }
        return num;
      case 'boolean':
        const lower = value.toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(lower)) return true;
        if (['false', '0', 'no', 'n'].includes(lower)) return false;
        throw new Error(`Invalid boolean: ${value}`);
      case 'date':
      case 'datetime':
      case 'timestamp':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date: ${value}`);
        }
        return date.toISOString();
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON: ${value}`);
        }
      case 'uuid':
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          throw new Error(`Invalid UUID: ${value}`);
        }
        return value;
      default:
        return value;
    }
  }

  /**
   * Validate field value
   */
  private validateField(
    value: unknown,
    validations: Array<{ type: string; value?: unknown; message?: string }>,
    fieldName: string
  ): FieldError[] {
    const errors: FieldError[] = [];

    for (const validation of validations) {
      switch (validation.type) {
        case 'min':
          if (typeof value === 'number' && value < (validation.value as number)) {
            errors.push({
              field: fieldName,
              message: validation.message || `Value must be at least ${validation.value}`,
              code: 'MIN_VALUE',
              value,
            });
          }
          break;
        case 'max':
          if (typeof value === 'number' && value > (validation.value as number)) {
            errors.push({
              field: fieldName,
              message: validation.message || `Value must be at most ${validation.value}`,
              code: 'MAX_VALUE',
              value,
            });
          }
          break;
        case 'minLength':
          if (typeof value === 'string' && value.length < (validation.value as number)) {
            errors.push({
              field: fieldName,
              message: validation.message || `Value must be at least ${validation.value} characters`,
              code: 'MIN_LENGTH',
              value,
            });
          }
          break;
        case 'maxLength':
          if (typeof value === 'string' && value.length > (validation.value as number)) {
            errors.push({
              field: fieldName,
              message: validation.message || `Value must be at most ${validation.value} characters`,
              code: 'MAX_LENGTH',
              value,
            });
          }
          break;
        case 'pattern':
          if (typeof value === 'string' && !new RegExp(validation.value as string).test(value)) {
            errors.push({
              field: fieldName,
              message: validation.message || `Value does not match pattern`,
              code: 'PATTERN_MISMATCH',
              value,
            });
          }
          break;
        case 'email':
          if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({
              field: fieldName,
              message: validation.message || `Invalid email format`,
              code: 'INVALID_EMAIL',
              value,
            });
          }
          break;
      }
    }

    return errors;
  }

  /**
   * Resolve lookups for a row
   */
  private async resolveLookups(
    data: Record<string, unknown>,
    columns: ColumnDefinition[]
  ): Promise<Record<string, unknown>> {
    const result = { ...data };

    for (const col of columns) {
      if (!col.lookup) continue;

      const lookup = col.lookup;
      const lookupKeys = Array.isArray(lookup.key) ? lookup.key : [lookup.key];
      const lookupValues = lookupKeys.map((k) => data[k]);

      try {
        let lookupResult: unknown;

        if (lookupKeys.length === 1) {
          lookupResult = await this.db.lookup(lookup.table, lookupKeys[0], lookupValues[0]);
        } else {
          lookupResult = await this.db.lookupComposite(lookup.table, lookupKeys, lookupValues);
        }

        if (lookupResult) {
          result[col.name] = (lookupResult as Record<string, unknown>)[lookup.return];
        } else if (lookup.fallback === 'error') {
          throw new Error(`Lookup failed for ${col.name}`);
        } else if (lookup.fallback === 'default') {
          result[col.name] = lookup.defaultValue;
        }
        // 'skip' fallback leaves the original value
      } catch (error) {
        if (lookup.fallback === 'error') {
          throw error;
        }
        if (lookup.fallback === 'default') {
          result[col.name] = lookup.defaultValue;
        }
      }
    }

    return result;
  }

  /**
   * Create batches from rows
   */
  private createBatches(
    rows: ParsedCSVRow[],
    batchSize: number
  ): Array<{ rows: ParsedCSVRow[]; startIndex: number }> {
    const batches: Array<{ rows: ParsedCSVRow[]; startIndex: number }> = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      batches.push({
        rows: rows.slice(i, i + batchSize),
        startIndex: i,
      });
    }

    return batches;
  }
}
