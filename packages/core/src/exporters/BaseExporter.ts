/**
 * Base Exporter Interface
 *
 * Defines the common interface for all exporters.
 */

import { MaskingEngine } from '../masking/MaskingEngine';
import { DataSpecDefinition, ColumnMapping } from '../types/spec.types';

export interface ExportConfig {
  spec: DataSpecDefinition;
  rows: Record<string, any>[];
  columns?: string[];
  applyMasking?: boolean;
  maskingEngine?: MaskingEngine;
  userRoles?: string[];
  options?: Record<string, any>;
}

export interface ExportResult {
  success: boolean;
  format: string;
  rowCount: number;
  data?: any;
  error?: string;
  metadata?: {
    fileName?: string;
    mimeType?: string;
    size?: number;
    columns?: string[];
  };
}

/**
 * Base Exporter abstract class
 */
export abstract class BaseExporter {
  protected spec: DataSpecDefinition;
  protected maskingEngine?: MaskingEngine;
  protected userRoles: string[];

  constructor(config: {
    spec: DataSpecDefinition;
    maskingEngine?: MaskingEngine;
    userRoles?: string[];
  }) {
    this.spec = config.spec;
    this.maskingEngine = config.maskingEngine;
    this.userRoles = config.userRoles || [];
  }

  /**
   * Export data to the target format
   */
  abstract export(config: ExportConfig): Promise<ExportResult>;

  /**
   * Get the format identifier
   */
  abstract getFormat(): string;

  /**
   * Get the MIME type for the format
   */
  abstract getMimeType(): string;

  /**
   * Get the file extension for the format
   */
  abstract getFileExtension(): string;

  /**
   * Apply masking to a row if configured
   */
  protected async applyMaskingToRow(
    row: Record<string, any>,
    columns: ColumnMapping[]
  ): Promise<Record<string, any>> {
    if (!this.maskingEngine) {
      return row;
    }

    const maskedRow: Record<string, any> = { ...row };

    for (const column of columns) {
      const value = maskedRow[column.name];

      if (value !== null && value !== undefined && column.sensitivity) {
        try {
          const maskResult = this.maskingEngine.mask(
            column.name,
            value,
            column.sensitivity
          );

          maskedRow[column.name] = maskResult.maskedValue;
        } catch (error) {
          // Keep original value if masking fails
        }
      }
    }

    return maskedRow;
  }

  /**
   * Get columns to export
   */
  protected getExportColumns(requestedColumns?: string[]): ColumnMapping[] {
    if (requestedColumns && requestedColumns.length > 0) {
      return this.spec.columns.filter(col =>
        requestedColumns.includes(col.name)
      );
    }

    return this.spec.columns;
  }

  /**
   * Get column names from column mappings
   */
  protected getColumnNames(columns: ColumnMapping[]): string[] {
    return columns.map(col => col.name);
  }

  /**
   * Format a value for export
   */
  protected formatValue(value: any, column: ColumnMapping): any {
    if (value === null || value === undefined) {
      return column.default ?? null;
    }

    // Type-specific formatting
    switch (column.type) {
      case 'date':
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return value;

      case 'datetime':
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;

      case 'boolean':
        return Boolean(value);

      case 'number':
      case 'integer':
        return Number(value);

      default:
        return String(value);
    }
  }
}

export default BaseExporter;
