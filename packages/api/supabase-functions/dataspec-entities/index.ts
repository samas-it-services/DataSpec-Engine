import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthContext, createSupabaseClient } from '../_shared/auth.ts';

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

    // GET /dataspec-entities - List all entities
    if (req.method === 'GET') {
      const includeSpecCount = url.searchParams.get('includeSpecCount') === 'true';

      // Fetch entities
      const { data: entities, error } = await supabase
        .from('dataspec_entities')
        .select('id, name, description, table_name, created_at, updated_at')
        .order('name', { ascending: true });

      if (error) {
        console.error('Database error:', error);
        return errorResponse('DATABASE_ERROR', error.message, 500);
      }

      // Optionally include spec counts
      let result = entities || [];

      if (includeSpecCount && result.length > 0) {
        const entityIds = result.map((e: { id: string }) => e.id);

        const { data: specs } = await supabase
          .from('dataspec_definitions')
          .select('id, entity_id')
          .in('entity_id', entityIds)
          .eq('is_active', true);

        // Count specs per entity
        const specCounts: Record<string, number> = {};
        (specs || []).forEach((spec: { entity_id: string }) => {
          specCounts[spec.entity_id] = (specCounts[spec.entity_id] || 0) + 1;
        });

        result = result.map((entity: { id: string }) => ({
          ...entity,
          specCount: specCounts[entity.id] || 0,
        }));
      }

      return successResponse(
        {
          entities: result.map((e: Record<string, unknown>) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            table: e.table_name,
            specCount: e.specCount,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
          })),
          total: result.length,
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
