import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthContext } from '../_shared/auth.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const authContext = await getAuthContext(req);
    const supabase = authContext.supabase;

    // GET /dataspec-specs - List specs for an entity
    if (req.method === 'GET') {
      const entityId = url.searchParams.get('entityId');
      const includeVersions = url.searchParams.get('includeVersions') === 'true';

      if (!entityId) {
        return errorResponse(
          'MISSING_PARAMETER',
          'entityId query parameter is required',
          400
        );
      }

      // Verify entity exists
      const { data: entity, error: entityError } = await supabase
        .from('dataspec_entities')
        .select('id')
        .eq('id', entityId)
        .single();

      if (entityError || !entity) {
        return errorResponse('NOT_FOUND', `Entity ${entityId} not found`, 404);
      }

      // Fetch specs
      const selectFields = includeVersions
        ? 'id, entity_id, name, version, description, yaml_content, is_active, created_at, updated_at'
        : 'id, entity_id, name, version, description, is_active, created_at, updated_at';

      const { data: specs, error } = await supabase
        .from('dataspec_definitions')
        .select(selectFields)
        .eq('entity_id', entityId)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .order('version', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        return errorResponse('DATABASE_ERROR', error.message, 500);
      }

      return successResponse(
        {
          specs: (specs || []).map((s: Record<string, unknown>) => ({
            id: s.id,
            entityId: s.entity_id,
            name: s.name,
            version: s.version,
            description: s.description,
            yamlContent: includeVersions ? s.yaml_content : undefined,
            isActive: s.is_active,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
          })),
          total: (specs || []).length,
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
