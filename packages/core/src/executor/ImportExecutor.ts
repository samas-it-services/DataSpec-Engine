/**
 * Import Executor
 *
 * Orchestrates the complete import pipeline:
 * 1. Parse and validate YAML spec
 * 2. Parse CSV/Excel data
 * 3. Validate rows (with hooks)
 * 4. Transform fields (with hooks)
 * 5. Resolve lookups (with hooks)
 * 6. Insert/Update records (with hooks)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DataSpecDefinition,
  ColumnMapping,
  DuplicateStrategy,
  ValidationType,
  ValidationRuleUnion
} from '../types/spec.types';
import {
  ExecutionMode,
  ExecutionContext,
  OperationStatus,
  RowOperation,
  RowProcessingResult,
  RowValidationResult,
  ValidationError,
  PreviewResult,
  ExecuteResult,
  DatabaseAdapter,
  LookupResult,
  TransformationResult
} from '../types/execution.types';
import { HookPoint } from '../types/hook.types';
import { FieldTransformer } from '../transformers/FieldTransformer';
import { LookupResolver } from '../lookup/LookupResolver';
import { HookExecutor } from '../hooks/HookExecutor';

/**
 * Import options
 */
export interface ImportOptions {
  mode: ExecutionMode;
  batchSize?: number;
  validateOnly?: boolean;
  userId?: string;
  userRoles?: string[];
}

/**
 * Import Executor class
 */
export class ImportExecutor {
  private transformer: FieldTransformer;
  private lookupResolver: LookupResolver;
  private hookExecutor: HookExecutor;

  constructor(
    private dbAdapter: DatabaseAdapter,
    options: {
      cacheTTL?: number;
      maxCacheSize?: number;
      hookTimeout?: number;
    } = {}
  ) {
    this.transformer = new FieldTransformer();
    this.lookupResolver = new LookupResolver(dbAdapter, {
      cacheTTL: options.cacheTTL,
      maxCacheSize: options.maxCacheSize
    });
    this.hookExecutor = new HookExecutor({
      timeout: options.hookTimeout
    });
  }

  /**
   * Execute import preview (no database writes)
   */
  async preview(
    spec: DataSpecDefinition,
    rows: Record<string, any>[],
    options: Omit<ImportOptions, 'mode'>
  ): Promise<PreviewResult> {
    return this.execute(spec, rows, {
      ...options,
      mode: ExecutionMode.PREVIEW
    }) as Promise<PreviewResult>;
  }

  /**
   * Execute full import with database writes
   */
  async import(
    spec: DataSpecDefinition,
    rows: Record<string, any>[],
    options: Omit<ImportOptions, 'mode'>
  ): Promise<ExecuteResult> {
    return this.execute(spec, rows, {
      ...options,
      mode: ExecutionMode.EXECUTE
    }) as Promise<ExecuteResult>;
  }

  /**
   * Main execution method
   */
  async execute(
    spec: DataSpecDefinition,
    rows: Record<string, any>[],
    options: ImportOptions
  ): Promise<PreviewResult | ExecuteResult> {
    const startTime = Date.now();
    const executionId = uuidv4();
    const correlationId = uuidv4();

    const context: ExecutionContext = {
      mode: options.mode,
      spec,
      userId: options.userId,
      userRoles: options.userRoles,
      correlationId,
      timestamp: new Date()
    };

    if (spec.hooks) {
      this.hookExecutor.registerFromConfig(spec.hooks);
    }

    const processedRows: RowProcessingResult[] = [];
    const allErrors: ValidationError[] = [];
    const allWarnings: string[] = [];

    const summary = {
      valid: 0,
      invalid: 0,
      inserts: 0,
      updates: 0,
      skips: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };

    const batchSize = options.batchSize || spec.importOptions?.batchSize || 100;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchResults = await this.processBatch(
        batch,
        spec,
        context,
        i,
        options
      );

      for (const result of batchResults) {
        processedRows.push(result);

        if (result.validationResult?.isValid) {
          summary.valid++;
        } else {
          summary.invalid++;
        }

        if (result.errors) {
          allErrors.push(...result.errors);
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings);
        }

        switch (result.operation) {
          case RowOperation.INSERT:
            summary.inserts++;
            break;
          case RowOperation.UPDATE:
            summary.updates++;
            break;
          case RowOperation.SKIP:
            summary.skips++;
            summary.skipped++;
            break;
        }

        if (result.status === OperationStatus.SUCCESS) {
          summary.successful++;
        } else if (result.status === OperationStatus.ERROR) {
          summary.failed++;
        }
      }
    }

    const executionTime = Date.now() - startTime;

    if (options.mode === ExecutionMode.PREVIEW) {
      return {
        spec,
        totalRows: rows.length,
        processedRows,
        summary: {
          valid: summary.valid,
          invalid: summary.invalid,
          inserts: summary.inserts,
          updates: summary.updates,
          skips: summary.skips
        },
        errors: allErrors,
        warnings: allWarnings,
        executionTime
      } as PreviewResult;
    }

    await this.dbAdapter.logOperation({
      operationType: 'import',
      specName: spec.metadata.name,
      entity: spec.metadata.entity,
      executionId,
      userId: options.userId,
      status: summary.failed > 0 ? OperationStatus.WARNING : OperationStatus.SUCCESS,
      totalRecords: rows.length,
      successfulRecords: summary.successful,
      failedRecords: summary.failed,
      executionTime,
      timestamp: new Date(),
      errors: allErrors.length > 0 ? allErrors : undefined
    });

    return {
      spec,
      totalRows: rows.length,
      processedRows,
      summary: {
        successful: summary.successful,
        failed: summary.failed,
        skipped: summary.skipped,
        inserts: summary.inserts,
        updates: summary.updates
      },
      errors: allErrors,
      warnings: allWarnings,
      executionTime,
      executionId
    } as ExecuteResult;
  }

  /**
   * Process a batch of rows
   */
  private async processBatch(
    batch: Record<string, any>[],
    spec: DataSpecDefinition,
    context: ExecutionContext,
    startIndex: number,
    options: ImportOptions
  ): Promise<RowProcessingResult[]> {
    const results: RowProcessingResult[] = [];

    for (let i = 0; i < batch.length; i++) {
      const rowIndex = startIndex + i;
      const row = batch[i];

      const result = await this.processRow(row, spec, context, rowIndex, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Process a single row
   */
  private async processRow(
    row: Record<string, any>,
    spec: DataSpecDefinition,
    context: ExecutionContext,
    rowIndex: number,
    options: ImportOptions
  ): Promise<RowProcessingResult> {
    const result: RowProcessingResult = {
      rowIndex,
      operation: RowOperation.INSERT,
      status: OperationStatus.SUCCESS,
      originalRow: row,
      errors: [],
      warnings: []
    };

    try {
      const beforeValidateResult = await this.hookExecutor.executeBeforeValidateRow({
        ...context,
        row,
        rowIndex
      });

      if (beforeValidateResult.stopProcessing) {
        result.operation = RowOperation.SKIP;
        result.status = OperationStatus.SKIPPED;
        return result;
      }

      const workingRow = beforeValidateResult.modifiedValue || row;

      const validationResult = await this.validateRow(
        workingRow,
        spec.columns,
        context,
        rowIndex
      );

      result.validationResult = validationResult;

      if (!validationResult.isValid) {
        result.status = OperationStatus.ERROR;
        result.errors = validationResult.errors;
        return result;
      }

      const { transformedRow, transformations } = await this.transformRow(
        workingRow,
        spec.columns,
        context,
        rowIndex
      );

      result.transformedRow = transformedRow;
      result.transformations = transformations;

      const { resolvedRow, lookupResults } = await this.resolveLookups(
        transformedRow,
        spec.columns,
        context,
        rowIndex
      );

      result.lookupResults = lookupResults;

      const failedLookups = lookupResults.filter(lr => !lr.success);
      if (failedLookups.length > 0) {
        result.status = OperationStatus.ERROR;
        result.errors = failedLookups.map(fl => ({
          field: fl.field,
          value: fl.lookupValue,
          rule: 'lookup',
          message: fl.error || 'Lookup failed'
        }));
        return result;
      }

      result.transformedRow = resolvedRow;

      if (options.mode === ExecutionMode.PREVIEW || options.validateOnly) {
        return result;
      }

      const existingRecord = await this.checkForDuplicate(
        resolvedRow,
        spec,
        context
      );

      if (existingRecord) {
        result.operation = await this.handleDuplicate(
          resolvedRow,
          existingRecord,
          spec,
          context,
          result
        );
      }

      if (result.operation === RowOperation.SKIP) {
        result.status = OperationStatus.SKIPPED;
        return result;
      }

      const beforeInsertResult = await this.hookExecutor.executeBeforeInsert({
        ...context,
        row: resolvedRow,
        rowIndex,
        operation: result.operation === RowOperation.UPDATE ? 'update' : 'insert'
      });

      if (beforeInsertResult.stopProcessing) {
        result.operation = RowOperation.SKIP;
        result.status = OperationStatus.SKIPPED;
        return result;
      }

      const finalRow = beforeInsertResult.modifiedValue || resolvedRow;

      if (result.operation === RowOperation.INSERT) {
        const insertResult = await this.dbAdapter.insert(
          spec.database.table,
          [finalRow]
        );

        if (insertResult.insertedIds.length > 0) {
          result.insertedId = insertResult.insertedIds[0];
          result.status = OperationStatus.SUCCESS;
        } else {
          result.status = OperationStatus.ERROR;
          if (insertResult.errors && insertResult.errors.length > 0) {
            result.errors = insertResult.errors.map(e => ({
              field: 'database',
              value: null,
              rule: 'insert',
              message: e.error
            }));
          }
        }
      } else if (result.operation === RowOperation.UPDATE) {
        const updateResult = await this.dbAdapter.update(
          spec.database.table,
          [finalRow],
          {
            select: '*',
            filters: [{
              field: spec.database.primaryKey,
              operator: '=',
              value: existingRecord[spec.database.primaryKey]
            }]
          }
        );

        if (updateResult.updatedCount > 0) {
          result.status = OperationStatus.SUCCESS;
        } else {
          result.status = OperationStatus.ERROR;
        }
      }

      await this.hookExecutor.executeAfterInsert({
        ...context,
        row: finalRow,
        rowIndex,
        operation: result.operation === RowOperation.UPDATE ? 'update' : 'insert',
        insertedId: result.insertedId,
        result
      });

      return result;
    } catch (error: any) {
      result.status = OperationStatus.ERROR;
      result.errors = result.errors || [];
      result.errors.push({
        field: 'system',
        value: null,
        rule: 'processing',
        message: error.message
      });
      return result;
    }
  }

  /**
   * Validate a row
   */
  private async validateRow(
    row: Record<string, any>,
    columns: ColumnMapping[],
    context: ExecutionContext,
    rowIndex: number
  ): Promise<RowValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    for (const column of columns) {
      const value = row[column.source];

      if (column.required && (value === null || value === undefined || value === '')) {
        errors.push({
          field: column.name,
          value,
          rule: 'required',
          message: `${column.name} is required`
        });
        continue;
      }

      if (column.validation) {
        for (const rule of column.validation) {
          const error = this.validateField(value, rule, column.name);
          if (error) {
            errors.push(error);
          }
        }
      }

      const hookResult = await this.hookExecutor.executeValidateField({
        ...context,
        field: column,
        value,
        row,
        rowIndex
      });

      if (!hookResult.success && hookResult.error) {
        errors.push({
          field: column.name,
          value,
          rule: 'custom',
          message: hookResult.error
        });
      }
    }

    return {
      rowIndex,
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single field value
   */
  private validateField(
    value: any,
    rule: ValidationRuleUnion,
    fieldName: string
  ): ValidationError | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    switch (rule.type) {
      case ValidationType.UUID: {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(String(value))) {
          return {
            field: fieldName,
            value,
            rule: 'uuid',
            message: rule.message || `${fieldName} must be a valid UUID`
          };
        }
        break;
      }

      case ValidationType.EMAIL: {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          return {
            field: fieldName,
            value,
            rule: 'email',
            message: rule.message || `${fieldName} must be a valid email`
          };
        }
        break;
      }

      case ValidationType.REGEX: {
        const regex = new RegExp(rule.pattern, rule.flags);
        if (!regex.test(String(value))) {
          return {
            field: fieldName,
            value,
            rule: 'regex',
            message: rule.message || `${fieldName} does not match the required pattern`
          };
        }
        break;
      }

      case ValidationType.RANGE: {
        const num = Number(value);
        if (isNaN(num)) {
          return {
            field: fieldName,
            value,
            rule: 'range',
            message: rule.message || `${fieldName} must be a number`
          };
        }
        if (rule.min !== undefined && num < rule.min) {
          return {
            field: fieldName,
            value,
            rule: 'range',
            message: rule.message || `${fieldName} must be at least ${rule.min}`
          };
        }
        if (rule.max !== undefined && num > rule.max) {
          return {
            field: fieldName,
            value,
            rule: 'range',
            message: rule.message || `${fieldName} must be at most ${rule.max}`
          };
        }
        break;
      }

      case ValidationType.LENGTH: {
        const len = String(value).length;
        if (rule.min !== undefined && len < rule.min) {
          return {
            field: fieldName,
            value,
            rule: 'length',
            message: rule.message || `${fieldName} must be at least ${rule.min} characters`
          };
        }
        if (rule.max !== undefined && len > rule.max) {
          return {
            field: fieldName,
            value,
            rule: 'length',
            message: rule.message || `${fieldName} must be at most ${rule.max} characters`
          };
        }
        break;
      }

      case ValidationType.ENUM: {
        if (!(rule.values as any[]).includes(value)) {
          return {
            field: fieldName,
            value,
            rule: 'enum',
            message: rule.message || `${fieldName} must be one of: ${rule.values.join(', ')}`
          };
        }
        break;
      }
    }

    return null;
  }

  /**
   * Transform a row
   */
  private async transformRow(
    row: Record<string, any>,
    columns: ColumnMapping[],
    context: ExecutionContext,
    rowIndex: number
  ): Promise<{
    transformedRow: Record<string, any>;
    transformations: TransformationResult[];
  }> {
    const transformedRow: Record<string, any> = {};
    const transformations: TransformationResult[] = [];

    for (const column of columns) {
      let value = row[column.source];

      if (value === undefined && column.default !== undefined) {
        value = column.default;
      }

      if (column.transform && column.transform.length > 0) {
        const originalValue = value;
        value = await this.transformer.transformChain(value, column.transform, column.name);

        transformations.push({
          field: column.name,
          originalValue,
          transformedValue: value,
          transformationType: column.transform.map(t => t.type).join(',')
        });
      }

      const hookResult = await this.hookExecutor.executeTransformField({
        ...context,
        field: column,
        value,
        row,
        rowIndex
      });

      if (hookResult.modifiedValue !== undefined) {
        value = hookResult.modifiedValue;
      }

      transformedRow[column.name] = value;
    }

    return { transformedRow, transformations };
  }

  /**
   * Resolve lookups for a row
   */
  private async resolveLookups(
    row: Record<string, any>,
    columns: ColumnMapping[],
    context: ExecutionContext,
    rowIndex: number
  ): Promise<{
    resolvedRow: Record<string, any>;
    lookupResults: LookupResult[];
  }> {
    const resolvedRow: Record<string, any> = { ...row };
    const lookupResults: LookupResult[] = [];

    for (const column of columns) {
      if (!column.lookup) {
        continue;
      }

      const sourceField = column.lookup.sourceField || column.name;
      const lookupValue = row[sourceField];

      const beforeLookupResult = await this.hookExecutor.executeBeforeLookup({
        ...context,
        field: column,
        lookupValue,
        row,
        rowIndex
      });

      const finalLookupValue = beforeLookupResult.modifiedValue ?? lookupValue;

      if (this.hookExecutor.hasHooks(HookPoint.PERFORM_LOOKUP, column.name)) {
        const performLookupResult = await this.hookExecutor.executePerformLookup({
          ...context,
          field: column,
          lookupValue: finalLookupValue,
          row,
          rowIndex
        });

        if (performLookupResult.modifiedValue !== undefined) {
          resolvedRow[column.name] = performLookupResult.modifiedValue;
          lookupResults.push({
            field: column.name,
            lookupValue: finalLookupValue,
            foundRecord: performLookupResult.modifiedValue,
            success: true
          });
          continue;
        }
      }

      const result = await this.lookupResolver.resolve(
        column.lookup,
        finalLookupValue,
        column.name
      );

      lookupResults.push(result);

      if (result.success && result.foundRecord) {
        const lookupKey = Array.isArray(column.lookup.key)
          ? column.lookup.key[0]
          : column.lookup.key;
        resolvedRow[column.name] = result.foundRecord[lookupKey] ?? result.foundRecord;
      }
    }

    return { resolvedRow, lookupResults };
  }

  /**
   * Check for duplicate record
   */
  private async checkForDuplicate(
    row: Record<string, any>,
    spec: DataSpecDefinition,
    _context: ExecutionContext
  ): Promise<any | null> {
    const primaryKey = spec.database.primaryKey;

    if (!row[primaryKey]) {
      return null;
    }

    return await this.dbAdapter.findOne(spec.database.table, {
      select: '*',
      filters: [{
        field: primaryKey,
        operator: '=',
        value: row[primaryKey]
      }]
    });
  }

  /**
   * Handle duplicate record based on strategy
   */
  private async handleDuplicate(
    row: Record<string, any>,
    _existingRecord: any,
    spec: DataSpecDefinition,
    _context: ExecutionContext,
    result: RowProcessingResult
  ): Promise<RowOperation> {
    const strategy = spec.importOptions?.duplicateStrategy || DuplicateStrategy.SKIP;

    switch (strategy) {
      case DuplicateStrategy.SKIP:
        result.warnings = result.warnings || [];
        result.warnings.push(`Skipping duplicate record: ${spec.database.primaryKey}=${row[spec.database.primaryKey]}`);
        return RowOperation.SKIP;

      case DuplicateStrategy.UPDATE:
        return RowOperation.UPDATE;

      case DuplicateStrategy.ERROR:
        result.errors = result.errors || [];
        result.errors.push({
          field: spec.database.primaryKey,
          value: row[spec.database.primaryKey],
          rule: 'duplicate',
          message: `Duplicate record found: ${spec.database.primaryKey}=${row[spec.database.primaryKey]}`
        });
        return RowOperation.SKIP;

      default:
        return RowOperation.SKIP;
    }
  }

  /**
   * Get lookup resolver statistics
   */
  getLookupStats() {
    return this.lookupResolver.getStats();
  }

  /**
   * Get hook executor statistics
   */
  getHookStats() {
    return this.hookExecutor.getStats();
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.lookupResolver.clearCache();
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.lookupResolver.resetStats();
    this.hookExecutor.resetStats();
  }
}

export default ImportExecutor;
