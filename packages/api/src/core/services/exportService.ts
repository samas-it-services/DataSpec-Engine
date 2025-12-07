import {
  ExportResult,
  ExportFormat,
  DatabaseAdapter,
  NotFoundException,
  ValidationException,
  InternalServerException,
  SensitivityLevel,
  AuthUser,
} from '../types';
import { SpecService } from './specService';
import { MaskingService } from './maskingService';

export interface ExportServiceDependencies {
  db: DatabaseAdapter;
  specService: SpecService;
  maskingService: MaskingService;
}

interface ColumnDefinition {
  name: string;
  source: string;
  type: string;
  required: boolean;
  sensitivity?: SensitivityLevel;
  masking?: {
    mode: string;
    visibleChars?: number;
    pattern?: string;
    replacement?: string;
  };
}

interface ParsedSpec {
  database: { table: string };
  columns: ColumnDefinition[];
  exportOptions?: {
    includeHeader?: boolean;
    delimiter?: string;
  };
}

export class ExportService {
  private db: DatabaseAdapter;
  private specService: SpecService;
  private maskingService: MaskingService;

  constructor(deps: ExportServiceDependencies) {
    this.db = deps.db;
    this.specService = deps.specService;
    this.maskingService = deps.maskingService;
  }

  /**
   * Export data based on spec definition
   */
  async export(
    specId: string,
    format: ExportFormat,
    applyMasking: boolean = true,
    filters?: Record<string, unknown>,
    fields?: string[],
    limit?: number,
    user?: AuthUser
  ): Promise<ExportResult> {
    try {
      // Get spec definition
      const spec = await this.specService.getSpecById(specId);
      if (!spec.yamlContent) {
        throw new ValidationException('Spec has no YAML content');
      }

      // Parse YAML spec
      const parsedSpec = this.specService.parseYaml(spec.yamlContent) as unknown as ParsedSpec;
      const tableName = parsedSpec.database.table;

      // Determine which columns to export
      const columnsToExport = fields
        ? parsedSpec.columns.filter((col) => fields.includes(col.name))
        : parsedSpec.columns;

      if (columnsToExport.length === 0) {
        throw new ValidationException('No valid columns to export');
      }

      // Build query
      const query = {
        select: columnsToExport.map((col) => col.name),
        filters: filters ? this.buildFilters(filters) : [],
        limit: limit || 10000,
      };

      // Fetch data
      const rows = await this.db.find(tableName, query);

      // Apply masking if needed
      let maskedFieldCount = 0;
      const processedRows = rows.map((row: unknown) => {
        const processedRow: Record<string, unknown> = {};
        const r = row as Record<string, unknown>;

        for (const col of columnsToExport) {
          let value = r[col.name];

          if (applyMasking && col.sensitivity && col.masking) {
            const canUnmask = user
              ? this.maskingService.canUnmask(user.roles, col.sensitivity)
              : false;

            if (!canUnmask && value !== null && value !== undefined) {
              value = this.maskingService.mask(
                String(value),
                col.sensitivity,
                col.masking.mode as 'full' | 'partial' | 'regex' | 'custom',
                col.masking
              );
              maskedFieldCount++;
            }
          }

          processedRow[col.name] = value;
        }

        return processedRow;
      });

      // Generate output based on format
      let data: string;
      let mimeType: string;
      let fileName: string;

      switch (format) {
        case 'csv':
          data = this.toCSV(processedRows, columnsToExport);
          mimeType = 'text/csv';
          fileName = `${spec.name}_export.csv`;
          break;
        case 'json':
          data = this.toJSON(processedRows);
          mimeType = 'application/json';
          fileName = `${spec.name}_export.json`;
          break;
        case 'xlsx':
          data = this.toXLSX(processedRows, columnsToExport);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileName = `${spec.name}_export.xlsx`;
          break;
        default:
          throw new ValidationException(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        data: Buffer.from(data).toString('base64'),
        fileName,
        mimeType,
        rowCount: processedRows.length,
        maskedFieldCount,
        format,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ValidationException
      ) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build query filters from filter object
   */
  private buildFilters(filters: Record<string, unknown>): Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';
    value: unknown;
  }> {
    const result: Array<{
      field: string;
      operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';
      value: unknown;
    }> = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Complex filter like { gt: 10 }
        const filterObj = value as Record<string, unknown>;
        for (const [op, val] of Object.entries(filterObj)) {
          const operator = this.mapOperator(op);
          if (operator) {
            result.push({ field: key, operator, value: val });
          }
        }
      } else {
        // Simple equality filter
        result.push({ field: key, operator: 'eq', value });
      }
    }

    return result;
  }

  /**
   * Map filter operator string to QueryFilter operator
   */
  private mapOperator(
    op: string
  ): 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike' | null {
    const mapping: Record<
      string,
      'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike'
    > = {
      eq: 'eq',
      neq: 'neq',
      ne: 'neq',
      gt: 'gt',
      gte: 'gte',
      lt: 'lt',
      lte: 'lte',
      in: 'in',
      like: 'like',
      ilike: 'ilike',
    };
    return mapping[op.toLowerCase()] || null;
  }

  /**
   * Convert rows to CSV format
   */
  private toCSV(
    rows: Record<string, unknown>[],
    columns: ColumnDefinition[]
  ): string {
    if (rows.length === 0) {
      return columns.map((c) => c.name).join(',');
    }

    const headers = columns.map((c) => c.name);
    const headerLine = headers.map((h) => this.escapeCSVValue(h)).join(',');

    const dataLines = rows.map((row) =>
      headers.map((h) => this.escapeCSVValue(String(row[h] ?? ''))).join(',')
    );

    return [headerLine, ...dataLines].join('\n');
  }

  /**
   * Escape a value for CSV
   */
  private escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Convert rows to JSON format
   */
  private toJSON(rows: Record<string, unknown>[]): string {
    return JSON.stringify(rows, null, 2);
  }

  /**
   * Convert rows to XLSX format (simplified - returns CSV-like format)
   * In a real implementation, this would use a library like xlsx
   */
  private toXLSX(
    rows: Record<string, unknown>[],
    columns: ColumnDefinition[]
  ): string {
    // Simplified implementation - in production, use xlsx library
    // This returns a tab-separated format that Excel can open
    if (rows.length === 0) {
      return columns.map((c) => c.name).join('\t');
    }

    const headers = columns.map((c) => c.name);
    const headerLine = headers.join('\t');

    const dataLines = rows.map((row) =>
      headers.map((h) => String(row[h] ?? '')).join('\t')
    );

    return [headerLine, ...dataLines].join('\n');
  }
}
