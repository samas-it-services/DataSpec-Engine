import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthContext, requireAuthentication } from '../_shared/auth.ts';

// Sensitivity levels
const SENSITIVITY_ROLE_MAP: Record<string, string[]> = {
  public: [],
  internal: ['internal', 'confidential', 'admin'],
  confidential: ['confidential', 'admin'],
  secret: ['secret', 'admin'],
  highly_restricted: ['highly_restricted', 'super_admin'],
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // POST /dataspec-masking - Mask a value
    if (req.method === 'POST' && path === 'dataspec-masking') {
      const body = await req.json();
      const { specId, fieldName, value } = body;

      if (!specId || !fieldName || value === undefined) {
        return errorResponse(
          'MISSING_PARAMETER',
          'specId, fieldName, and value are required',
          400
        );
      }

      const authContext = await getAuthContext(req);
      const supabase = authContext.supabase;

      // Get spec to determine field configuration
      const { data: spec, error: specError } = await supabase
        .from('dataspec_definitions')
        .select('yaml_content')
        .eq('id', specId)
        .single();

      if (specError || !spec) {
        return errorResponse('NOT_FOUND', `Spec ${specId} not found`, 404);
      }

      // Get field config (simplified - would parse YAML in production)
      const fieldConfig = getFieldConfig(spec.yaml_content, fieldName);

      // Apply masking
      const maskedValue = mask(
        String(value),
        fieldConfig.mode,
        fieldConfig.options
      );

      return successResponse(
        {
          maskedValue,
          sensitivity: fieldConfig.sensitivity,
          maskingMode: fieldConfig.mode,
        },
        { duration: Date.now() - startTime }
      );
    }

    // POST /dataspec-masking/unmask - Unmask a value (requires auth)
    if (req.method === 'POST' && url.pathname.includes('unmask')) {
      const authContext = await getAuthContext(req);

      // Check authentication
      const authError = requireAuthentication(authContext);
      if (authError) return authError;

      const body = await req.json();
      const { specId, fieldName, maskedValue, rowId, reason } = body;

      if (!specId || !fieldName || !maskedValue || !rowId) {
        return errorResponse(
          'MISSING_PARAMETER',
          'specId, fieldName, maskedValue, and rowId are required',
          400
        );
      }

      const supabase = authContext.supabase;

      // Get spec
      const { data: spec, error: specError } = await supabase
        .from('dataspec_definitions')
        .select('yaml_content')
        .eq('id', specId)
        .single();

      if (specError || !spec) {
        return errorResponse('NOT_FOUND', `Spec ${specId} not found`, 404);
      }

      // Get field sensitivity
      const fieldConfig = getFieldConfig(spec.yaml_content, fieldName);

      // Check permission
      const userRoles = authContext.user!.roles;
      const requiredRoles = SENSITIVITY_ROLE_MAP[fieldConfig.sensitivity] || [];

      if (requiredRoles.length > 0) {
        const hasRole = userRoles.some((role) => requiredRoles.includes(role));
        if (!hasRole) {
          return errorResponse(
            'INSUFFICIENT_PERMISSIONS',
            `Insufficient permissions to unmask field with sensitivity level: ${fieldConfig.sensitivity}`,
            403
          );
        }
      }

      // Log unmask event
      await supabase.from('unmask_audit_log').insert({
        spec_id: specId,
        user_id: authContext.user!.id,
        field_name: fieldName,
        row_id: rowId,
        reason: reason || 'No reason provided',
        created_at: new Date().toISOString(),
      });

      // In a real implementation, fetch the original value from the database
      // For now, return success
      return successResponse(
        {
          success: true,
          auditId: 'audit-logged',
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
 * Get field configuration from YAML content
 */
function getFieldConfig(
  yamlContent: string,
  fieldName: string
): {
  sensitivity: string;
  mode: string;
  options: {
    visibleChars?: number;
    pattern?: string;
    replacement?: string;
  };
} {
  // Simple regex extraction (in production, use proper YAML parser)
  const fieldPattern = new RegExp(
    `name:\\s*${fieldName}[\\s\\S]*?(?=\\n\\s*-\\s*name:|$)`,
    'i'
  );
  const fieldMatch = yamlContent.match(fieldPattern);

  if (!fieldMatch) {
    return { sensitivity: 'public', mode: 'full', options: {} };
  }

  const fieldSection = fieldMatch[0];

  const sensitivityMatch = /sensitivity:\s*(\w+)/i.exec(fieldSection);
  const sensitivity = sensitivityMatch ? sensitivityMatch[1].toLowerCase() : 'public';

  const modeMatch = /mode:\s*(\w+)/i.exec(fieldSection);
  const mode = modeMatch ? modeMatch[1].toLowerCase() : 'full';

  const visibleCharsMatch = /visibleChars:\s*(\d+)/i.exec(fieldSection);

  return {
    sensitivity,
    mode,
    options: {
      visibleChars: visibleCharsMatch ? parseInt(visibleCharsMatch[1], 10) : undefined,
    },
  };
}

/**
 * Mask a value
 */
function mask(
  value: string,
  mode: string,
  options: { visibleChars?: number; pattern?: string; replacement?: string }
): string {
  if (!value || value.length === 0) {
    return value;
  }

  const replacement = options.replacement || '*';

  switch (mode) {
    case 'full':
      return replacement.repeat(Math.min(value.length, 10));

    case 'partial':
      const visibleChars = options.visibleChars || 3;
      if (value.length <= visibleChars * 2) {
        return replacement.repeat(value.length);
      }
      const start = value.substring(0, visibleChars);
      const end = value.substring(value.length - visibleChars);
      const middle = replacement.repeat(Math.min(value.length - visibleChars * 2, 5));
      return `${start}${middle}${end}`;

    case 'regex':
      if (options.pattern) {
        try {
          const regex = new RegExp(options.pattern, 'g');
          return value.replace(regex, replacement.repeat(3));
        } catch {
          return replacement.repeat(Math.min(value.length, 10));
        }
      }
      return replacement.repeat(Math.min(value.length, 10));

    default:
      return replacement.repeat(Math.min(value.length, 10));
  }
}
