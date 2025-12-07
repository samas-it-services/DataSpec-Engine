import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse } from './cors.ts';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  supabase: SupabaseClient;
}

/**
 * Create Supabase client for Edge Functions
 */
export function createSupabaseClient(authHeader?: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

/**
 * Extract and validate user from request
 */
export async function getAuthContext(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization');
  const supabase = createSupabaseClient(authHeader || undefined);

  if (!authHeader) {
    return {
      user: null,
      isAuthenticated: false,
      supabase,
    };
  }

  try {
    // Verify JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        isAuthenticated: false,
        supabase,
      };
    }

    // Get user roles from metadata or a roles table
    const roles = (user.app_metadata?.roles as string[]) || ['user'];

    return {
      user: {
        id: user.id,
        email: user.email || '',
        roles,
      },
      isAuthenticated: true,
      supabase,
    };
  } catch {
    return {
      user: null,
      isAuthenticated: false,
      supabase,
    };
  }
}

/**
 * Require authentication - returns error response if not authenticated
 */
export function requireAuthentication(
  authContext: AuthContext
): Response | null {
  if (!authContext.isAuthenticated || !authContext.user) {
    return errorResponse(
      'AUTHENTICATION_REQUIRED',
      'Authentication is required for this operation',
      401
    );
  }
  return null;
}

/**
 * Require specific roles - returns error response if not authorized
 */
export function requireRoles(
  authContext: AuthContext,
  requiredRoles: string[]
): Response | null {
  // First check authentication
  const authError = requireAuthentication(authContext);
  if (authError) return authError;

  // Check roles
  const userRoles = authContext.user!.roles;
  const hasRole = requiredRoles.some((role) => userRoles.includes(role));

  if (!hasRole) {
    return errorResponse(
      'INSUFFICIENT_PERMISSIONS',
      `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      403
    );
  }

  return null;
}
