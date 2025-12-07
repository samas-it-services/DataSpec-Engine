/**
 * Parquet Exporter
 *
 * Exports data to Apache Parquet format for data lake integration.
 * Parquet is a columnar storage format optimized for analytics workloads.
 *
 * Note: This exporter creates Parquet-compatible JSON that can be converted
 * to actual Parquet format using parquetjs or similar libraries.
 * For full Parquet support, install: npm install parquetjs-lite
 */

import { BaseExporter, ExportConfig, ExportResult } from './BaseExporter';
import { ColumnMapping } from '../types/spec.types';

export interface ParquetExportOptions {
  compression?: 'UNCOMPRESSED' | 'GZIP' | 'SNAPPY' | 'LZO' | 'BROTLI' | 'LZ4';
  rowGroupSize?: number;
  pageSize?: number;
  useNativeTypes?: boolean;
  includeSchema?: boolean;
}

export interface ParquetSchema {
  name: string;
  type: string;
  repetition: 'REQUIRED' | 'OPTIONAL' | 'REPEATED';
  logicalType?: string;
}

const DEFAULT_OPTIONS: Required<ParquetExportOptions> = {
  compression: 'SNAPPY',
  rowGroupSize: 10000,
  pageSize: 8192,
  useNativeTypes: true,
  includeSchema: true
};

/**
 * Parquet Exporter class
 */
export class ParquetExporter extends BaseExporter {
  getFormat(): string {
    return 'parquet';
  }

  getMimeType(): string {
    return 'application/vnd.apache.parquet';
  }

  getFileExtension(): string {
    return '.parquet';
  }

  /**
   * Export data to Parquet-compatible format
   *
   * This method returns a JSON representation that can be easily converted
   * to Parquet format using parquetjs or similar libraries.
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    try {
      const options: Required<ParquetExportOptions> = {
        ...DEFAULT_OPTIONS,
        ...(config.options as ParquetExportOptions)
      };

      const columns = this.getExportColumns(config.columns);
      const rows = config.rows;

      // Apply masking if configured
      const processedRows = config.applyMasking
        ? await Promise.all(rows.map(row => this.applyMaskingToRow(row, columns)))
        : rows;

      // Build schema
      const schema = this.buildSchema(columns);

      // Convert to columnar format (Parquet is column-oriented)
      const columnarData = this.toColumnarFormat(processedRows, columns, options);

      // Build Parquet-compatible structure
      const parquetData = {
        metadata: {
          version: '2.0',
          schema: options.includeSchema ? schema : undefined,
          rowCount: rows.length,
          columnCount: columns.length,
          compression: options.compression,
          createdBy: 'DataSpec Engine',
          entity: this.spec.metadata.entity,
          exportedAt: new Date().toISOString()
        },
        schema,
        columns: columnarData,
        // Include row-oriented data for compatibility
        rows: processedRows
      };

      return {
        success: true,
        format: this.getFormat(),
        rowCount: rows.length,
        data: parquetData,
        metadata: {
          fileName: `${this.spec.metadata.entity}_export${this.getFileExtension()}`,
          mimeType: this.getMimeType(),
          size: JSON.stringify(parquetData).length,
          columns: this.getColumnNames(columns)
        }
      };
    } catch (error: any) {
      return {
        success: false,
        format: this.getFormat(),
        rowCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Build Parquet schema from column definitions
   */
  private buildSchema(columns: ColumnMapping[]): ParquetSchema[] {
    return columns.map(column => ({
      name: column.name,
      type: this.mapToParquetType(column.type),
      repetition: column.required ? 'REQUIRED' : 'OPTIONAL',
      logicalType: this.getLogicalType(column.type)
    }));
  }

  /**
   * Map DataSpec types to Parquet types
   */
  private mapToParquetType(type?: string): string {
    switch (type) {
      case 'string':
      case 'text':
        return 'BYTE_ARRAY';
      case 'integer':
      case 'int':
        return 'INT32';
      case 'bigint':
        return 'INT64';
      case 'number':
      case 'float':
      case 'decimal':
        return 'DOUBLE';
      case 'boolean':
      case 'bool':
        return 'BOOLEAN';
      case 'date':
        return 'INT32'; // Days since epoch
      case 'datetime':
      case 'timestamp':
        return 'INT64'; // Milliseconds since epoch
      case 'uuid':
        return 'FIXED_LEN_BYTE_ARRAY'; // 16 bytes
      case 'json':
        return 'BYTE_ARRAY';
      default:
        return 'BYTE_ARRAY';
    }
  }

  /**
   * Get Parquet logical type
   */
  private getLogicalType(type?: string): string | undefined {
    switch (type) {
      case 'string':
      case 'text':
        return 'STRING';
      case 'date':
        return 'DATE';
      case 'datetime':
      case 'timestamp':
        return 'TIMESTAMP_MILLIS';
      case 'uuid':
        return 'UUID';
      case 'json':
        return 'JSON';
      case 'decimal':
        return 'DECIMAL';
      default:
        return undefined;
    }
  }

  /**
   * Convert row-oriented data to columnar format
   */
  private toColumnarFormat(
    rows: Record<string, any>[],
    columns: ColumnMapping[],
    options: Required<ParquetExportOptions>
  ): Record<string, any[]> {
    const columnarData: Record<string, any[]> = {};

    for (const column of columns) {
      const values: any[] = [];

      for (const row of rows) {
        let value = row[column.name];

        if (options.useNativeTypes) {
          value = this.convertToNativeType(value, column.type);
        }

        values.push(value);
      }

      columnarData[column.name] = values;
    }

    return columnarData;
  }

  /**
   * Convert value to native Parquet type
   */
  private convertToNativeType(value: any, type?: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'integer':
      case 'int':
        return Math.floor(Number(value));
      case 'bigint':
        return BigInt(value).toString(); // JSON doesn't support BigInt
      case 'number':
      case 'float':
      case 'decimal':
        return Number(value);
      case 'boolean':
      case 'bool':
        return Boolean(value);
      case 'date':
        // Days since Unix epoch
        const date = new Date(value);
        return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
      case 'datetime':
      case 'timestamp':
        // Milliseconds since Unix epoch
        return new Date(value).getTime();
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value);
      default:
        return String(value);
    }
  }

  /**
   * Generate Parquet file using parquetjs (if available)
   * This is a placeholder for actual Parquet file generation
   */
  async generateParquetFile(
    config: ExportConfig
  ): Promise<Buffer | null> {
    // This would use parquetjs-lite to generate actual Parquet file
    // For now, return null as parquetjs is an optional dependency

    try {
      // Dynamic import for optional dependency
      // @ts-ignore - parquetjs-lite is an optional dependency
      const parquet = await import('parquetjs-lite').catch(() => null);

      if (!parquet) {
        console.warn('parquetjs-lite not installed. Install with: npm install parquetjs-lite');
        return null;
      }

      const columns = this.getExportColumns(config.columns);
      const rows = config.rows;

      // Build parquetjs schema
      const schemaFields: Record<string, any> = {};
      for (const column of columns) {
        schemaFields[column.name] = {
          type: this.mapToParquetJSType(column.type),
          optional: !column.required
        };
      }

      const schema = new parquet.ParquetSchema(schemaFields);

      // Create writer (in-memory)
      const chunks: Buffer[] = [];
      const writer = await parquet.ParquetWriter.openStream(
        schema,
        {
          write: (chunk: Buffer) => chunks.push(chunk),
          end: () => {}
        }
      );

      // Apply masking if configured
      const processedRows = config.applyMasking
        ? await Promise.all(rows.map(row => this.applyMaskingToRow(row, columns)))
        : rows;

      // Write rows
      for (const row of processedRows) {
        await writer.appendRow(row);
      }

      await writer.close();

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Error generating Parquet file:', error);
      return null;
    }
  }

  /**
   * Map to parquetjs types
   */
  private mapToParquetJSType(type?: string): string {
    switch (type) {
      case 'string':
      case 'text':
        return 'UTF8';
      case 'integer':
      case 'int':
        return 'INT32';
      case 'bigint':
        return 'INT64';
      case 'number':
      case 'float':
        return 'DOUBLE';
      case 'decimal':
        return 'FLOAT';
      case 'boolean':
      case 'bool':
        return 'BOOLEAN';
      case 'date':
      case 'datetime':
      case 'timestamp':
        return 'TIMESTAMP_MILLIS';
      case 'json':
        return 'JSON';
      default:
        return 'UTF8';
    }
  }

  /**
   * Get statistics about the exported data
   */
  getStatistics(data: any): {
    rowCount: number;
    columnCount: number;
    nullCounts: Record<string, number>;
    distinctCounts: Record<string, number>;
  } {
    const stats = {
      rowCount: data.rows?.length || 0,
      columnCount: data.schema?.length || 0,
      nullCounts: {} as Record<string, number>,
      distinctCounts: {} as Record<string, number>
    };

    if (data.columns) {
      for (const [columnName, values] of Object.entries(data.columns)) {
        const columnValues = values as any[];

        // Count nulls
        stats.nullCounts[columnName] = columnValues.filter(
          v => v === null || v === undefined
        ).length;

        // Count distinct values
        stats.distinctCounts[columnName] = new Set(columnValues).size;
      }
    }

    return stats;
  }
}

export default ParquetExporter;
