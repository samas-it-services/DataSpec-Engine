import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { parse as parseYAML } from 'https://deno.land/std@0.177.0/yaml/mod.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthContext } from '../_shared/auth.ts';

interface FieldError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

interface PreviewRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: FieldError[];
  isValid: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();

  try {
    // POST /dataspec-preview - Preview import
    if (req.method === 'POST') {
      const body = await req.json();
      const { specId, fileContent, fileName, maxRows = 200 } = body;

      if (!specId || !fileContent || !fileName) {
        return errorResponse(
          'MISSING_PARAMETER',
          'specId, fileContent, and fileName are required',
          400
        );
      }

      // Limit maxRows for Edge Functions
      const effectiveMaxRows = Math.min(maxRows, 300);

      const authContext = await getAuthContext(req);
      const supabase = authContext.supabase;

      // Get spec
      const { data: spec, error: specError } = await supabase
        .from('dataspec_definitions')
        .select('id, name, yaml_content')
        .eq('id', specId)
        .single();

      if (specError || !spec) {
        return errorResponse('NOT_FOUND', `Spec ${specId} not found`, 404);
      }

      if (!spec.yaml_content) {
        return errorResponse('VALIDATION_ERROR', 'Spec has no YAML content', 400);
      }

      // Parse YAML spec
      const parsedSpec = parseYAML(spec.yaml_content) as Record<string, unknown>;
      const columns = parsedSpec.columns as Array<Record<string, unknown>>;

      // Parse CSV
      const rows = parseCSV(fileContent, fileName);
      const previewRows = rows.slice(0, effectiveMaxRows);

      // Build column info
      const columnInfo = columns.map((col) => ({
        name: col.name as string,
        sourceColumn: col.source as string,
        type: col.type as string,
        required: (col.required as boolean) ?? false,
        sensitivity: col.sensitivity as string | undefined,
        isMasked: !!col.masking,
      }));

      // Process rows
      const processedRows: PreviewRow[] = [];

      for (let i = 0; i < previewRows.length; i++) {
        const row = previewRows[i];
        const { data, errors } = processRow(row, columns, i);

        processedRows.push({
          rowIndex: i,
          data,
          errors,
          isValid: errors.length === 0,
        });
      }

      const validRows = processedRows.filter((r) => r.isValid).length;
      const invalidRows = processedRows.filter((r) => !r.isValid).length;

      return successResponse(
        {
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
          columns: columnInfo,
          warnings:
            rows.length > effectiveMaxRows
              ? [`Only showing ${effectiveMaxRows} of ${rows.length} rows. Use Docker API for full preview.`]
              : [],
        },
        { duration: Date.now() - startTime }
      );
    }

    return errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`, 405);
  } catch (error) {
    console.error('Edge function error:', error);
    return errorResponse(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
});

/**
 * Parse CSV content
 */
function parseCSV(content: string, fileName: string): Record<string, string>[] {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension !== 'csv') {
    throw new Error(`Unsupported file format: ${extension}`);
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
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
 * Process a single row
 */
function processRow(
  row: Record<string, string>,
  columns: Array<Record<string, unknown>>,
  _rowIndex: number
): { data: Record<string, unknown>; errors: FieldError[] } {
  const data: Record<string, unknown> = {};
  const errors: FieldError[] = [];

  for (const col of columns) {
    const name = col.name as string;
    const source = col.source as string;
    const type = col.type as string;
    const required = (col.required as boolean) ?? false;

    const sourceValue = row[source];
    let value: unknown = sourceValue;

    // Check required
    if (required && (sourceValue === undefined || sourceValue === '')) {
      errors.push({
        field: name,
        message: `Field ${name} is required`,
        code: 'REQUIRED_FIELD',
        value: sourceValue,
      });
      continue;
    }

    // Type conversion
    try {
      value = convertType(sourceValue, type);
    } catch (typeError) {
      errors.push({
        field: name,
        message: `Type conversion failed: ${typeError instanceof Error ? typeError.message : 'Unknown error'}`,
        code: 'TYPE_ERROR',
        value: sourceValue,
      });
      continue;
    }

    data[name] = value;
  }

  return { data, errors };
}

/**
 * Convert value to target type
 */
function convertType(value: string, type: string): unknown {
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
    default:
      return value;
  }
}
