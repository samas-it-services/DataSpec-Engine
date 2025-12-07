/**
 * Exporters Module
 *
 * Export data to various formats: XML, Parquet, Google Sheets
 */

import { BaseExporter } from './BaseExporter';
import { XMLExporter } from './XMLExporter';
import { ParquetExporter } from './ParquetExporter';
import { GoogleSheetsExporter } from './GoogleSheetsExporter';

export { BaseExporter } from './BaseExporter';
export type { ExportConfig, ExportResult } from './BaseExporter';

export { XMLExporter } from './XMLExporter';
export type { XMLExportOptions } from './XMLExporter';

export { ParquetExporter } from './ParquetExporter';
export type { ParquetExportOptions, ParquetSchema } from './ParquetExporter';

export { GoogleSheetsExporter } from './GoogleSheetsExporter';
export type {
  GoogleSheetsExportOptions,
  GoogleCredentials,
  GoogleSheetsConfig
} from './GoogleSheetsExporter';

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'xml' | 'parquet' | 'google-sheets' | 'excel';

/**
 * Factory function to create appropriate exporter
 */
export function createExporter(
  format: ExportFormat,
  config: {
    spec: any;
    maskingEngine?: any;
    userRoles?: string[];
  }
): BaseExporter {
  switch (format) {
    case 'xml':
      return new XMLExporter(config);
    case 'parquet':
      return new ParquetExporter(config);
    case 'google-sheets':
      return new GoogleSheetsExporter(config);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
