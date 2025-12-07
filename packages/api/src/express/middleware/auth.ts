import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthContext, AuthUser, JwtPayload } from '../../core/types';

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}

/**
 * JWT Authentication middleware
 * Extracts and validates JWT token from Authorization header
 */
export function authMiddleware(options?: {
  required?: boolean;
  roles?: string[];
}) {
  const { required = false, roles = [] } = options || {};

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Initialize auth context
    req.auth = {
      user: null,
      isAuthenticated: false,
    };

    if (!authHeader) {
      if (required) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
          },
        });
      }
      return next();
    }

    // Extract token from Bearer scheme
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid authorization header format. Use: Bearer <token>',
        },
      });
    }

    const token = parts[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_CONFIGURATION_ERROR',
          message: 'Server authentication is not properly configured',
        },
      });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Build user object
      const user: AuthUser = {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles || [],
      };

      // Check required roles if specified
      if (roles.length > 0) {
        const hasRequiredRole = roles.some((role) =>
          user.roles.includes(role)
        );

        if (!hasRequiredRole) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `This action requires one of the following roles: ${roles.join(', ')}`,
            },
          });
        }
      }

      // Set auth context
      req.auth = {
        user,
        isAuthenticated: true,
        token,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
          },
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
          },
        });
      }

      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication error occurred',
        },
      });
    }
  };
}

/**
 * Require authentication - shorthand middleware
 */
export const requireAuth = authMiddleware({ required: true });

/**
 * Require specific roles - shorthand middleware
 */
export function requireRoles(...roles: string[]) {
  return authMiddleware({ required: true, roles });
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: AuthUser, expiresIn: string | number = '24h'): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

/**
 * Verify a JWT token without middleware
 */
export function verifyToken(token: string): JwtPayload | null {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return null;
  }

  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}
