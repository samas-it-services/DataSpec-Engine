/**
 * XML Exporter
 *
 * Exports data to XML format for legacy system compatibility.
 */

import { BaseExporter, ExportConfig, ExportResult } from './BaseExporter';

export interface XMLExportOptions {
  rootElement?: string;
  rowElement?: string;
  declaration?: boolean;
  indent?: boolean;
  indentSize?: number;
  encoding?: string;
  attributes?: Record<string, string>;
  cdata?: string[]; // Fields to wrap in CDATA
}

const DEFAULT_OPTIONS: Required<XMLExportOptions> = {
  rootElement: 'data',
  rowElement: 'row',
  declaration: true,
  indent: true,
  indentSize: 2,
  encoding: 'UTF-8',
  attributes: {},
  cdata: []
};

/**
 * XML Exporter class
 */
export class XMLExporter extends BaseExporter {
  getFormat(): string {
    return 'xml';
  }

  getMimeType(): string {
    return 'application/xml';
  }

  getFileExtension(): string {
    return '.xml';
  }

  /**
   * Export data to XML format
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    try {
      const options: Required<XMLExportOptions> = {
        ...DEFAULT_OPTIONS,
        ...(config.options as XMLExportOptions)
      };

      const columns = this.getExportColumns(config.columns);
      const rows = config.rows;

      // Apply masking if configured
      const processedRows = config.applyMasking
        ? await Promise.all(rows.map(row => this.applyMaskingToRow(row, columns)))
        : rows;

      // Build XML content
      const xmlContent = this.buildXML(processedRows, columns, options);

      return {
        success: true,
        format: this.getFormat(),
        rowCount: rows.length,
        data: xmlContent,
        metadata: {
          fileName: `${this.spec.metadata.entity}_export${this.getFileExtension()}`,
          mimeType: this.getMimeType(),
          size: Buffer.byteLength(xmlContent, 'utf-8'),
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
   * Build XML content from rows
   */
  private buildXML(
    rows: Record<string, any>[],
    columns: { name: string; type?: string }[],
    options: Required<XMLExportOptions>
  ): string {
    const indent = options.indent ? ' '.repeat(options.indentSize) : '';
    const newline = options.indent ? '\n' : '';
    const lines: string[] = [];

    // XML declaration
    if (options.declaration) {
      lines.push(`<?xml version="1.0" encoding="${options.encoding}"?>`);
    }

    // Root element with attributes
    let rootAttrs = '';
    for (const [key, value] of Object.entries(options.attributes)) {
      rootAttrs += ` ${key}="${this.escapeXML(value)}"`;
    }
    lines.push(`<${options.rootElement}${rootAttrs}>`);

    // Add metadata
    lines.push(`${indent}<metadata>`);
    lines.push(`${indent}${indent}<entity>${this.escapeXML(this.spec.metadata.entity)}</entity>`);
    lines.push(`${indent}${indent}<rowCount>${rows.length}</rowCount>`);
    lines.push(`${indent}${indent}<exportedAt>${new Date().toISOString()}</exportedAt>`);
    lines.push(`${indent}</metadata>`);

    // Add column definitions
    lines.push(`${indent}<columns>`);
    for (const column of columns) {
      lines.push(`${indent}${indent}<column name="${this.escapeXML(column.name)}" type="${column.type || 'string'}" />`);
    }
    lines.push(`${indent}</columns>`);

    // Add rows
    lines.push(`${indent}<rows>`);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      lines.push(`${indent}${indent}<${options.rowElement} index="${i}">`);

      for (const column of columns) {
        const value = row[column.name];
        const formattedValue = this.formatXMLValue(value, column.name, options);
        lines.push(`${indent}${indent}${indent}<${column.name}>${formattedValue}</${column.name}>`);
      }

      lines.push(`${indent}${indent}</${options.rowElement}>`);
    }
    lines.push(`${indent}</rows>`);

    // Close root element
    lines.push(`</${options.rootElement}>`);

    return lines.join(newline);
  }

  /**
   * Format a value for XML output
   */
  private formatXMLValue(
    value: any,
    fieldName: string,
    options: Required<XMLExportOptions>
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // Use CDATA for specified fields
    if (options.cdata.includes(fieldName)) {
      return `<![CDATA[${stringValue}]]>`;
    }

    return this.escapeXML(stringValue);
  }

  /**
   * Escape special XML characters
   */
  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse XML content back to rows (utility method)
   */
  static parseXML(xmlContent: string): {
    rows: Record<string, string>[];
    metadata: Record<string, any>;
  } {
    const rows: Record<string, string>[] = [];
    const metadata: Record<string, any> = {};

    // Simple XML parsing (for basic use cases)
    // For production, use a proper XML parser like xml2js

    // Extract metadata
    const entityMatch = xmlContent.match(/<entity>([^<]*)<\/entity>/);
    if (entityMatch) {
      metadata.entity = entityMatch[1];
    }

    const rowCountMatch = xmlContent.match(/<rowCount>([^<]*)<\/rowCount>/);
    if (rowCountMatch) {
      metadata.rowCount = parseInt(rowCountMatch[1], 10);
    }

    // Extract rows
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(xmlContent)) !== null) {
      const rowContent = rowMatch[1];
      const row: Record<string, string> = {};

      // Extract field values
      const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(rowContent)) !== null) {
        const fieldName = fieldMatch[1];
        let fieldValue = fieldMatch[2];

        // Handle CDATA
        const cdataMatch = fieldValue.match(/^<!\[CDATA\[(.*)\]\]>$/);
        if (cdataMatch) {
          fieldValue = cdataMatch[1];
        } else {
          // Unescape XML entities
          fieldValue = fieldValue
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
        }

        row[fieldName] = fieldValue;
      }

      rows.push(row);
    }

    return { rows, metadata };
  }
}

export default XMLExporter;
