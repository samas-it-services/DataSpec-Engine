import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { parse as parseYAML } from 'https://deno.land/std@0.177.0/yaml/mod.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/cors.ts';

interface ValidationError {
  path: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();

  try {
    // POST /dataspec-validate - Validate YAML spec
    if (req.method === 'POST') {
      const body = await req.json();
      const yamlContent = body.yamlContent;

      if (!yamlContent) {
        return errorResponse(
          'MISSING_PARAMETER',
          'yamlContent is required in request body',
          400
        );
      }

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      let parsedSpec = null;

      try {
        // Parse YAML
        const spec = parseYAML(yamlContent) as Record<string, unknown>;

        // Validate required fields
        if (!spec.version) {
          errors.push({
            path: 'version',
            message: 'Version is required',
            code: 'REQUIRED_FIELD',
          });
        }

        if (!spec.metadata) {
          errors.push({
            path: 'metadata',
            message: 'Metadata section is required',
            code: 'REQUIRED_FIELD',
          });
        } else {
          const metadata = spec.metadata as Record<string, unknown>;
          if (!metadata.entity) {
            errors.push({
              path: 'metadata.entity',
              message: 'Entity name is required',
              code: 'REQUIRED_FIELD',
            });
          }
          if (!metadata.name) {
            errors.push({
              path: 'metadata.name',
              message: 'Spec name is required',
              code: 'REQUIRED_FIELD',
            });
          }
        }

        if (!spec.database) {
          errors.push({
            path: 'database',
            message: 'Database section is required',
            code: 'REQUIRED_FIELD',
          });
        } else {
          const database = spec.database as Record<string, unknown>;
          if (!database.table) {
            errors.push({
              path: 'database.table',
              message: 'Database table name is required',
              code: 'REQUIRED_FIELD',
            });
          }
        }

        const columns = spec.columns as Array<Record<string, unknown>> | undefined;
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
          errors.push({
            path: 'columns',
            message: 'At least one column definition is required',
            code: 'REQUIRED_FIELD',
          });
        } else {
          // Validate columns
          columns.forEach((col, index) => {
            const prefix = `columns[${index}]`;

            if (!col.name) {
              errors.push({
                path: `${prefix}.name`,
                message: 'Column name is required',
                code: 'REQUIRED_FIELD',
              });
            }

            if (!col.source) {
              errors.push({
                path: `${prefix}.source`,
                message: 'Source column is required',
                code: 'REQUIRED_FIELD',
              });
            }

            if (!col.type) {
              errors.push({
                path: `${prefix}.type`,
                message: 'Column type is required',
                code: 'REQUIRED_FIELD',
              });
            }

            // Check masking without sensitivity
            if (col.masking && !col.sensitivity) {
              warnings.push({
                path: `${prefix}.masking`,
                message: 'Masking is defined but no sensitivity level is set',
                suggestion: 'Consider adding a sensitivity level',
              });
            }
          });
        }

        // Build parsed spec if no errors
        if (errors.length === 0) {
          const metadata = spec.metadata as Record<string, unknown>;
          parsedSpec = {
            version: spec.version,
            entity: metadata?.entity || '',
            columns: (columns || []).map((col) => ({
              name: col.name,
              source: col.source,
              type: col.type,
              required: col.required ?? false,
              sensitivity: col.sensitivity,
            })),
            hooks: (spec.hooks as Array<{ point: string }> | undefined)?.map((h) => h.point),
          };
        }
      } catch (parseError) {
        errors.push({
          path: '',
          message: `YAML parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          code: 'YAML_PARSE_ERROR',
        });
      }

      return successResponse(
        {
          valid: errors.length === 0,
          errors,
          warnings,
          parsedSpec,
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
