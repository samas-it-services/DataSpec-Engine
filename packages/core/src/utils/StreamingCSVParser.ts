/**
 * Streaming CSV Parser
 *
 * High-performance CSV parsing with streaming support for large files.
 * Parses CSV data incrementally without loading the entire file into memory.
 */

import { Readable } from 'stream';

export interface CSVParseOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  hasHeader?: boolean;
  skipRows?: number;
  encoding?: BufferEncoding;
  maxRowsPerChunk?: number;
  trimValues?: boolean;
}

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  errors: CSVParseError[];
}

export interface CSVParseError {
  row: number;
  message: string;
  rawLine?: string;
}

export interface CSVChunk {
  rows: Record<string, string>[];
  startIndex: number;
  endIndex: number;
}

const DEFAULT_OPTIONS: Required<CSVParseOptions> = {
  delimiter: ',',
  quote: '"',
  escape: '"',
  hasHeader: true,
  skipRows: 0,
  encoding: 'utf-8',
  maxRowsPerChunk: 1000,
  trimValues: true
};

/**
 * Streaming CSV Parser class
 */
export class StreamingCSVParser {
  private options: Required<CSVParseOptions>;

  constructor(options: CSVParseOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse CSV content from a string
   */
  parse(content: string): CSVParseResult {
    const lines = this.splitLines(content);
    const errors: CSVParseError[] = [];
    let headers: string[] = [];
    const rows: Record<string, string>[] = [];

    let lineIndex = 0;
    let dataRowIndex = 0;

    // Skip initial rows
    while (lineIndex < this.options.skipRows && lineIndex < lines.length) {
      lineIndex++;
    }

    // Parse header
    if (this.options.hasHeader && lineIndex < lines.length) {
      try {
        headers = this.parseLine(lines[lineIndex]);
        lineIndex++;
      } catch (error: any) {
        errors.push({
          row: lineIndex,
          message: `Failed to parse header: ${error.message}`,
          rawLine: lines[lineIndex]
        });
        return { headers: [], rows: [], totalRows: 0, errors };
      }
    }

    // Parse data rows
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Skip empty lines
      if (line.trim() === '') {
        lineIndex++;
        continue;
      }

      try {
        const values = this.parseLine(line);
        const row = this.createRow(headers, values);
        rows.push(row);
        dataRowIndex++;
      } catch (error: any) {
        errors.push({
          row: lineIndex,
          message: error.message,
          rawLine: line
        });
      }

      lineIndex++;
    }

    return {
      headers,
      rows,
      totalRows: dataRowIndex,
      errors
    };
  }

  /**
   * Parse CSV content in chunks (for large files)
   * Returns an async generator that yields chunks of rows
   */
  async *parseChunks(
    content: string,
    chunkSize?: number
  ): AsyncGenerator<CSVChunk> {
    const maxRows = chunkSize || this.options.maxRowsPerChunk;
    const lines = this.splitLines(content);
    let headers: string[] = [];

    let lineIndex = 0;
    let rowIndex = 0;

    // Skip initial rows
    while (lineIndex < this.options.skipRows && lineIndex < lines.length) {
      lineIndex++;
    }

    // Parse header
    if (this.options.hasHeader && lineIndex < lines.length) {
      headers = this.parseLine(lines[lineIndex]);
      lineIndex++;
    }

    // Process in chunks
    let currentChunk: Record<string, string>[] = [];
    let chunkStartIndex = 0;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Skip empty lines
      if (line.trim() === '') {
        lineIndex++;
        continue;
      }

      try {
        const values = this.parseLine(line);
        const row = this.createRow(headers, values);
        currentChunk.push(row);
        rowIndex++;

        // Yield chunk when size reached
        if (currentChunk.length >= maxRows) {
          yield {
            rows: currentChunk,
            startIndex: chunkStartIndex,
            endIndex: rowIndex - 1
          };
          chunkStartIndex = rowIndex;
          currentChunk = [];
        }
      } catch (error) {
        // Skip invalid rows in streaming mode
      }

      lineIndex++;
    }

    // Yield remaining rows
    if (currentChunk.length > 0) {
      yield {
        rows: currentChunk,
        startIndex: chunkStartIndex,
        endIndex: rowIndex - 1
      };
    }
  }

  /**
   * Parse CSV from a readable stream
   */
  async parseStream(
    stream: Readable,
    onChunk: (chunk: CSVChunk) => Promise<void>
  ): Promise<{ totalRows: number; errors: CSVParseError[] }> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let headers: string[] = [];
      let lineIndex = 0;
      let rowIndex = 0;
      const errors: CSVParseError[] = [];
      let currentChunk: Record<string, string>[] = [];
      let chunkStartIndex = 0;
      let headerParsed = false;
      let skippedRows = 0;

      const processLine = async (line: string): Promise<boolean> => {
        // Skip initial rows
        if (skippedRows < this.options.skipRows) {
          skippedRows++;
          return false;
        }

        // Parse header
        if (!headerParsed && this.options.hasHeader) {
          try {
            headers = this.parseLine(line);
            headerParsed = true;
            return false;
          } catch (error: any) {
            errors.push({
              row: lineIndex,
              message: `Failed to parse header: ${error.message}`,
              rawLine: line
            });
            return false;
          }
        }

        // Skip empty lines
        if (line.trim() === '') {
          return false;
        }

        // Parse data row
        try {
          const values = this.parseLine(line);
          const row = this.createRow(headers, values);
          currentChunk.push(row);
          rowIndex++;

          // Yield chunk when size reached
          if (currentChunk.length >= this.options.maxRowsPerChunk) {
            await onChunk({
              rows: currentChunk,
              startIndex: chunkStartIndex,
              endIndex: rowIndex - 1
            });
            chunkStartIndex = rowIndex;
            currentChunk = [];
          }
        } catch (error: any) {
          errors.push({
            row: lineIndex,
            message: error.message,
            rawLine: line
          });
        }

        return true;
      };

      stream.on('data', async (chunk: Buffer) => {
        buffer += chunk.toString(this.options.encoding);
        const lines = buffer.split(/\r?\n/);

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          await processLine(line);
          lineIndex++;
        }
      });

      stream.on('end', async () => {
        // Process remaining buffer
        if (buffer.trim()) {
          await processLine(buffer);
        }

        // Yield remaining rows
        if (currentChunk.length > 0) {
          await onChunk({
            rows: currentChunk,
            startIndex: chunkStartIndex,
            endIndex: rowIndex - 1
          });
        }

        resolve({ totalRows: rowIndex, errors });
      });

      stream.on('error', reject);
    });
  }

  /**
   * Parse a single CSV line into values
   */
  parseLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (inQuotes) {
        if (char === this.options.escape && line[i + 1] === this.options.quote) {
          // Escaped quote
          current += this.options.quote;
          i += 2;
        } else if (char === this.options.quote) {
          // End of quoted field
          inQuotes = false;
          i++;
        } else {
          current += char;
          i++;
        }
      } else {
        if (char === this.options.quote) {
          // Start of quoted field
          inQuotes = true;
          i++;
        } else if (char === this.options.delimiter) {
          // End of field
          values.push(this.options.trimValues ? current.trim() : current);
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }
    }

    // Add last field
    values.push(this.options.trimValues ? current.trim() : current);

    if (inQuotes) {
      throw new Error('Unterminated quoted field');
    }

    return values;
  }

  /**
   * Split content into lines (handling different line endings)
   */
  private splitLines(content: string): string[] {
    return content.split(/\r?\n/);
  }

  /**
   * Create a row object from headers and values
   */
  private createRow(headers: string[], values: string[]): Record<string, string> {
    const row: Record<string, string> = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = i < values.length ? values[i] : '';
      row[header] = value;
    }

    // Add extra values with generated column names
    for (let i = headers.length; i < values.length; i++) {
      row[`column_${i + 1}`] = values[i];
    }

    return row;
  }

  /**
   * Get count of rows without fully parsing
   */
  countRows(content: string): number {
    const lines = this.splitLines(content);
    let count = 0;
    let startIndex = this.options.skipRows;

    if (this.options.hasHeader) {
      startIndex++;
    }

    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i].trim() !== '') {
        count++;
      }
    }

    return count;
  }

  /**
   * Extract headers from CSV content
   */
  getHeaders(content: string): string[] {
    const lines = this.splitLines(content);

    // Skip initial rows
    let lineIndex = this.options.skipRows;

    if (lineIndex < lines.length) {
      return this.parseLine(lines[lineIndex]);
    }

    return [];
  }

  /**
   * Parse only the first N rows (for preview)
   */
  parsePreview(content: string, maxRows: number): CSVParseResult {
    const lines = this.splitLines(content);
    const errors: CSVParseError[] = [];
    let headers: string[] = [];
    const rows: Record<string, string>[] = [];

    let lineIndex = this.options.skipRows;

    // Parse header
    if (this.options.hasHeader && lineIndex < lines.length) {
      try {
        headers = this.parseLine(lines[lineIndex]);
        lineIndex++;
      } catch (error: any) {
        errors.push({
          row: lineIndex,
          message: `Failed to parse header: ${error.message}`,
          rawLine: lines[lineIndex]
        });
        return { headers: [], rows: [], totalRows: 0, errors };
      }
    }

    // Count total rows
    let totalRows = 0;
    for (let i = lineIndex; i < lines.length; i++) {
      if (lines[i].trim() !== '') {
        totalRows++;
      }
    }

    // Parse data rows (limited)
    let parsedRows = 0;
    while (lineIndex < lines.length && parsedRows < maxRows) {
      const line = lines[lineIndex];

      if (line.trim() === '') {
        lineIndex++;
        continue;
      }

      try {
        const values = this.parseLine(line);
        const row = this.createRow(headers, values);
        rows.push(row);
        parsedRows++;
      } catch (error: any) {
        errors.push({
          row: lineIndex,
          message: error.message,
          rawLine: line
        });
      }

      lineIndex++;
    }

    return {
      headers,
      rows,
      totalRows,
      errors
    };
  }
}

export default StreamingCSVParser;
