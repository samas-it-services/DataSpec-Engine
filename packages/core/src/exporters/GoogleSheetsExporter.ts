/**
 * Google Sheets Exporter
 *
 * Exports data directly to Google Sheets using the Google Sheets API.
 * Requires Google API credentials to be configured.
 */

import { BaseExporter, ExportConfig, ExportResult } from './BaseExporter';
import { ColumnMapping } from '../types/spec.types';

export interface GoogleSheetsExportOptions {
  spreadsheetId?: string; // Existing spreadsheet to update
  spreadsheetName?: string; // Name for new spreadsheet
  sheetName?: string;
  startCell?: string;
  includeHeaders?: boolean;
  formatHeaders?: boolean;
  autoResize?: boolean;
  credentials?: GoogleCredentials;
}

export interface GoogleCredentials {
  type: 'service_account' | 'oauth2';
  clientEmail?: string;
  privateKey?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}


export interface GoogleSheetsConfig {
  credentials: GoogleCredentials;
  scopes?: string[];
}

const DEFAULT_OPTIONS: Omit<Required<GoogleSheetsExportOptions>, 'spreadsheetId' | 'credentials'> = {
  spreadsheetName: 'DataSpec Export',
  sheetName: 'Sheet1',
  startCell: 'A1',
  includeHeaders: true,
  formatHeaders: true,
  autoResize: true
};

/**
 * Google Sheets Exporter class
 *
 * Note: This exporter returns data in a format compatible with Google Sheets API.
 * Actual API calls require googleapis to be installed: npm install googleapis
 */
export class GoogleSheetsExporter extends BaseExporter {
  /**
   * Stored credentials for use when making API calls.
   * Used by exportToGoogleSheets and shareSpreadsheet methods.
   */
  public storedCredentials?: GoogleCredentials;

  getFormat(): string {
    return 'google-sheets';
  }

  getMimeType(): string {
    return 'application/vnd.google-apps.spreadsheet';
  }

  getFileExtension(): string {
    return '.gsheet';
  }

  /**
   * Set Google API credentials for later use
   */
  setCredentials(credentials: GoogleCredentials): void {
    this.storedCredentials = credentials;
  }

  /**
   * Get stored credentials
   */
  getCredentials(): GoogleCredentials | undefined {
    return this.storedCredentials;
  }

  /**
   * Export data to Google Sheets format
   *
   * Returns data in a format ready for Google Sheets API.
   * Use exportToGoogleSheets() for direct API integration.
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    try {
      const options: GoogleSheetsExportOptions = {
        ...DEFAULT_OPTIONS,
        ...(config.options as GoogleSheetsExportOptions)
      };

      const columns = this.getExportColumns(config.columns);
      const rows = config.rows;

      // Apply masking if configured
      const processedRows = config.applyMasking
        ? await Promise.all(rows.map(row => this.applyMaskingToRow(row, columns)))
        : rows;

      // Build Google Sheets compatible data structure
      const sheetData = this.buildSheetData(processedRows, columns, options);

      // Build update request for Sheets API
      const sheetsRequest = {
        spreadsheetId: options.spreadsheetId,
        range: `${options.sheetName}!${options.startCell}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: sheetData
        }
      };

      // Build formatting requests
      const formatRequests = this.buildFormatRequests(columns, options);

      return {
        success: true,
        format: this.getFormat(),
        rowCount: rows.length,
        data: {
          sheetData,
          sheetsRequest,
          formatRequests,
          metadata: {
            spreadsheetName: options.spreadsheetName,
            sheetName: options.sheetName,
            rowCount: rows.length + (options.includeHeaders ? 1 : 0),
            columnCount: columns.length
          }
        },
        metadata: {
          fileName: `${this.spec.metadata.entity}_export`,
          mimeType: this.getMimeType(),
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
   * Build sheet data as 2D array (Google Sheets format)
   */
  private buildSheetData(
    rows: Record<string, any>[],
    columns: ColumnMapping[],
    options: GoogleSheetsExportOptions
  ): any[][] {
    const data: any[][] = [];

    // Add headers
    if (options.includeHeaders) {
      data.push(columns.map(col => col.name));
    }

    // Add data rows
    for (const row of rows) {
      const rowData: any[] = [];

      for (const column of columns) {
        const value = row[column.name];
        rowData.push(this.formatValueForSheets(value, column));
      }

      data.push(rowData);
    }

    return data;
  }

  /**
   * Format value for Google Sheets
   */
  private formatValueForSheets(value: any, column: ColumnMapping): any {
    if (value === null || value === undefined) {
      return '';
    }

    // Cast to string for flexible type matching (handles both enum and string values)
    const columnType = column.type as string;
    switch (columnType) {
      case 'date':
        // Google Sheets date format
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return value;

      case 'datetime':
      case 'timestamp':
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;

      case 'boolean':
        return value ? 'TRUE' : 'FALSE';

      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return Number(value);

      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value);

      default:
        return String(value);
    }
  }

  /**
   * Build formatting requests for Google Sheets API
   */
  private buildFormatRequests(
    columns: ColumnMapping[],
    options: GoogleSheetsExportOptions
  ): any[] {
    const requests: any[] = [];

    if (options.formatHeaders) {
      // Bold header row
      requests.push({
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: columns.length
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true
              },
              backgroundColor: {
                red: 0.9,
                green: 0.9,
                blue: 0.9
              }
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)'
        }
      });

      // Freeze header row
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: 0,
            gridProperties: {
              frozenRowCount: 1
            }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      });
    }

    if (options.autoResize) {
      // Auto-resize columns
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: 0,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: columns.length
          }
        }
      });
    }

    // Add number formatting for specific column types
    columns.forEach((column, index) => {
      let numberFormat: any = null;

      // Cast to string for flexible type matching
      const columnType = column.type as string;
      switch (columnType) {
        case 'date':
          numberFormat = { type: 'DATE', pattern: 'yyyy-mm-dd' };
          break;
        case 'datetime':
        case 'timestamp':
          numberFormat = { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm:ss' };
          break;
        case 'decimal':
        case 'float':
          numberFormat = { type: 'NUMBER', pattern: '#,##0.00' };
          break;
        case 'integer':
          numberFormat = { type: 'NUMBER', pattern: '#,##0' };
          break;
      }

      if (numberFormat) {
        requests.push({
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 1, // Skip header
              startColumnIndex: index,
              endColumnIndex: index + 1
            },
            cell: {
              userEnteredFormat: {
                numberFormat
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        });
      }
    });

    return requests;
  }

  /**
   * Export directly to Google Sheets using the API
   * Requires googleapis to be installed
   */
  async exportToGoogleSheets(
    config: ExportConfig,
    googleConfig: GoogleSheetsConfig
  ): Promise<{
    success: boolean;
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    error?: string;
  }> {
    try {
      // Dynamic import for optional dependency
      // @ts-ignore - googleapis is an optional dependency
      const { google } = await import('googleapis').catch(() => ({ google: null }));

      if (!google) {
        return {
          success: false,
          error: 'googleapis not installed. Install with: npm install googleapis'
        };
      }

      const options = config.options as GoogleSheetsExportOptions || {};

      // Authenticate
      const auth = await this.authenticate(google, googleConfig);

      const sheets = google.sheets({ version: 'v4', auth });

      // Get export data
      const exportResult = await this.export(config);
      if (!exportResult.success || !exportResult.data) {
        return {
          success: false,
          error: exportResult.error || 'Failed to prepare export data'
        };
      }

      const { sheetData, formatRequests } = exportResult.data;

      let spreadsheetId = options.spreadsheetId;

      // Create new spreadsheet if needed
      if (!spreadsheetId) {
        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: options.spreadsheetName || DEFAULT_OPTIONS.spreadsheetName
            },
            sheets: [{
              properties: {
                title: options.sheetName || DEFAULT_OPTIONS.sheetName
              }
            }]
          }
        });

        spreadsheetId = createResponse.data.spreadsheetId!;
      }

      // Write data
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${options.sheetName || DEFAULT_OPTIONS.sheetName}!${options.startCell || DEFAULT_OPTIONS.startCell}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: sheetData
        }
      });

      // Apply formatting
      if (formatRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: formatRequests
          }
        });
      }

      return {
        success: true,
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Authenticate with Google API
   */
  private async authenticate(google: any, config: GoogleSheetsConfig): Promise<any> {
    const { credentials } = config;
    const scopes = config.scopes || [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];

    if (credentials.type === 'service_account') {
      const auth = new google.auth.JWT(
        credentials.clientEmail,
        undefined,
        credentials.privateKey,
        scopes
      );
      await auth.authorize();
      return auth;
    }

    if (credentials.type === 'oauth2') {
      const oauth2Client = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret
      );

      oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken
      });

      return oauth2Client;
    }

    throw new Error('Invalid credentials type');
  }

  /**
   * Generate shareable link for spreadsheet
   */
  async shareSpreadsheet(
    spreadsheetId: string,
    email: string,
    role: 'reader' | 'writer' | 'owner',
    googleConfig: GoogleSheetsConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // @ts-ignore - googleapis is an optional dependency
      const { google } = await import('googleapis').catch(() => ({ google: null }));

      if (!google) {
        return {
          success: false,
          error: 'googleapis not installed'
        };
      }

      const auth = await this.authenticate(google, googleConfig);
      const drive = google.drive({ version: 'v3', auth });

      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email
        }
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default GoogleSheetsExporter;
