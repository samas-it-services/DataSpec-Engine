/**
 * Export Executor
 *
 * Handles data export with automatic masking based on user roles.
 * Supports CSV, Excel, and JSON formats.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DataSpecDefinition,
  ColumnMapping
} from '../types/spec.types';
import {
  OperationStatus,
  ExportResult,
  DatabaseAdapter,
  QueryBuilder
} from '../types/execution.types';
import { MaskingEngine } from '../masking/MaskingEngine';
import { HookExecutor } from '../hooks/HookExecutor';

/**
 * Export options
 */
export interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  applyMasking?: boolean;
  includeAuditFields?: boolean;
  userId?: string;
  userRoles?: string[];
  filters?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
  offset?: number;
}

/**
 * CSV generation options
 */
interface CSVOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  quoteStrings?: boolean;
}

/**
 * Export Executor class
 */
export class ExportExecutor {
  private maskingEngine: MaskingEngine;
  private hookExecutor: HookExecutor;

  constructor(
    private dbAdapter: DatabaseAdapter,
    options: {
      roleConfig?: Record<string, any>;
      hookTimeout?: number;
    } = {}
  ) {
    this.maskingEngine = new MaskingEngine({
      roleConfig: options.roleConfig
    });
    this.hookExecutor = new HookExecutor({
      timeout: options.hookTimeout
    });
  }

  /**
   * Execute data export
   */
  async export(
    spec: DataSpecDefinition,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const executionId = uuidv4();

    if (spec.hooks) {
      this.hookExecutor.registerFromConfig(spec.hooks);
    }

    const query = this.buildQuery(spec, options);
    const rawRows = await this.dbAdapter.find(spec.database.table, query);

    const userRoles = options.userRoles || [];
    const applyMasking = options.applyMasking ?? spec.exportOptions?.applyMasking ?? true;

    let processedRows: Record<string, any>[];

    if (applyMasking) {
      const { maskedRows } = this.maskingEngine.maskDataset(
        rawRows,
        spec.columns,
        userRoles
      );
      processedRows = maskedRows;
    } else {
      processedRows = rawRows;
    }

    processedRows = this.selectColumns(processedRows, spec.columns, options);

    let data: any;
    switch (options.format) {
      case 'csv':
        data = this.toCSV(processedRows, spec.columns);
        break;
      case 'json':
        data = this.toJSON(processedRows);
        break;
      case 'excel':
        data = this.toExcelData(processedRows, spec.columns);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    const executionTime = Date.now() - startTime;

    await this.dbAdapter.logOperation({
      operationType: 'export',
      specName: spec.metadata.name,
      entity: spec.metadata.entity,
      executionId,
      userId: options.userId,
      userRole: userRoles.join(','),
      status: OperationStatus.SUCCESS,
      totalRecords: processedRows.length,
      executionTime,
      timestamp: new Date(),
      metadata: {
        format: options.format,
        maskingApplied: applyMasking
      }
    });

    return {
      spec,
      totalRows: processedRows.length,
      format: options.format,
      data,
      maskingApplied: applyMasking,
      executionTime,
      executionId
    };
  }

  /**
   * Build database query from options
   */
  private buildQuery(
    spec: DataSpecDefinition,
    options: ExportOptions
  ): QueryBuilder {
    const columnNames = spec.columns.map(c => c.name);
    const select = columnNames.join(', ');

    const query: QueryBuilder = {
      select,
      filters: options.filters || []
    };

    if (options.orderBy) {
      query.orderBy = options.orderBy;
    }

    if (options.limit) {
      query.limit = options.limit;
    }

    if (options.offset) {
      query.offset = options.offset;
    }

    return query;
  }

  /**
   * Select and order columns based on spec
   */
  private selectColumns(
    rows: Record<string, any>[],
    columns: ColumnMapping[],
    options: ExportOptions
  ): Record<string, any>[] {
    const includeAudit = options.includeAuditFields ?? false;

    return rows.map(row => {
      const selected: Record<string, any> = {};

      for (const column of columns) {
        if (column.name in row) {
          selected[column.name] = row[column.name];
        }
      }

      if (includeAudit) {
        const auditFields = ['created_at', 'updated_at', 'created_by', 'updated_by'];
        for (const field of auditFields) {
          if (field in row) {
            selected[field] = row[field];
          }
        }
      }

      return selected;
    });
  }

  /**
   * Convert rows to CSV format
   */
  private toCSV(
    rows: Record<string, any>[],
    columns: ColumnMapping[],
    options: CSVOptions = {}
  ): string {
    const delimiter = options.delimiter || ',';
    const includeHeaders = options.includeHeaders ?? true;
    const quoteStrings = options.quoteStrings ?? true;

    const lines: string[] = [];

    if (includeHeaders) {
      const headers = columns.map(c => this.escapeCSV(c.name, delimiter, quoteStrings));
      lines.push(headers.join(delimiter));
    }

    for (const row of rows) {
      const values = columns.map(c => {
        const value = row[c.name];
        return this.escapeCSV(value, delimiter, quoteStrings);
      });
      lines.push(values.join(delimiter));
    }

    return lines.join('\n');
  }

  /**
   * Escape a value for CSV
   */
  private escapeCSV(value: any, delimiter: string, quoteStrings: boolean): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);

    if (
      quoteStrings &&
      (str.includes(delimiter) || str.includes('"') || str.includes('\n'))
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Convert rows to JSON format
   */
  private toJSON(rows: Record<string, any>[]): string {
    return JSON.stringify(rows, null, 2);
  }

  /**
   * Convert rows to Excel-compatible data structure
   * Returns a structure that can be used with xlsx library
   */
  private toExcelData(
    rows: Record<string, any>[],
    columns: ColumnMapping[]
  ): {
    headers: string[];
    data: any[][];
    columnTypes: Record<string, string>;
  } {
    const headers = columns.map(c => c.name);
    const columnTypes: Record<string, string> = {};

    for (const column of columns) {
      columnTypes[column.name] = column.type;
    }

    const data = rows.map(row =>
      columns.map(c => row[c.name] ?? null)
    );

    return {
      headers,
      data,
      columnTypes
    };
  }

  /**
   * Export with streaming for large datasets
   */
  async *exportStream(
    spec: DataSpecDefinition,
    options: ExportOptions,
    batchSize: number = 1000
  ): AsyncGenerator<string> {
    const userRoles = options.userRoles || [];
    const applyMasking = options.applyMasking ?? true;

    const query = this.buildQuery(spec, options);
    let offset = 0;
    let isFirst = true;

    if (options.format === 'csv') {
      const headers = spec.columns.map(c => this.escapeCSV(c.name, ',', true));
      yield headers.join(',') + '\n';
    } else if (options.format === 'json') {
      yield '[\n';
    }

    while (true) {
      const batchQuery = {
        ...query,
        limit: batchSize,
        offset
      };

      const rawRows = await this.dbAdapter.find(spec.database.table, batchQuery);

      if (rawRows.length === 0) {
        break;
      }

      let processedRows: Record<string, any>[];

      if (applyMasking) {
        const { maskedRows } = this.maskingEngine.maskDataset(
          rawRows,
          spec.columns,
          userRoles
        );
        processedRows = maskedRows;
      } else {
        processedRows = rawRows;
      }

      processedRows = this.selectColumns(processedRows, spec.columns, options);

      if (options.format === 'csv') {
        for (const row of processedRows) {
          const values = spec.columns.map(c =>
            this.escapeCSV(row[c.name], ',', true)
          );
          yield values.join(',') + '\n';
        }
      } else if (options.format === 'json') {
        for (const row of processedRows) {
          if (!isFirst) {
            yield ',\n';
          }
          yield JSON.stringify(row);
          isFirst = false;
        }
      }

      offset += batchSize;

      if (rawRows.length < batchSize) {
        break;
      }
    }

    if (options.format === 'json') {
      yield '\n]';
    }
  }

  /**
   * Get count of records that would be exported
   */
  async getExportCount(
    spec: DataSpecDefinition,
    options: ExportOptions
  ): Promise<number> {
    const query: QueryBuilder = {
      select: 'COUNT(*) as count',
      filters: options.filters || []
    };

    const result = await this.dbAdapter.find(spec.database.table, query);
    return result[0]?.count || 0;
  }

  /**
   * Preview export (first N rows)
   */
  async preview(
    spec: DataSpecDefinition,
    options: ExportOptions,
    limit: number = 10
  ): Promise<{
    rows: Record<string, any>[];
    totalCount: number;
    columnsToMask: string[];
  }> {
    const userRoles = options.userRoles || [];

    const totalCount = await this.getExportCount(spec, options);

    const previewOptions = {
      ...options,
      limit
    };

    const query = this.buildQuery(spec, previewOptions);
    const rawRows = await this.dbAdapter.find(spec.database.table, query);

    const columnsToMask = this.maskingEngine
      .getFieldsToMask(spec.columns, userRoles)
      .map(c => c.name);

    const applyMasking = options.applyMasking ?? true;

    let rows: Record<string, any>[];

    if (applyMasking) {
      const { maskedRows } = this.maskingEngine.maskDataset(
        rawRows,
        spec.columns,
        userRoles
      );
      rows = maskedRows;
    } else {
      rows = rawRows;
    }

    rows = this.selectColumns(rows, spec.columns, options);

    return {
      rows,
      totalCount,
      columnsToMask
    };
  }

  /**
   * Get masking engine for configuration
   */
  getMaskingEngine(): MaskingEngine {
    return this.maskingEngine;
  }
}

export default ExportExecutor;
