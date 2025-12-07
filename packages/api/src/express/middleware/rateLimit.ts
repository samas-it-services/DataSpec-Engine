import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Default rate limit configuration
 */
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;

/**
 * Rate limit presets for different endpoint types
 */
export const rateLimitPresets = {
  // Standard API endpoints
  standard: {
    windowMs: DEFAULT_WINDOW_MS,
    max: DEFAULT_MAX_REQUESTS,
  },

  // Read-only endpoints (more lenient)
  readOnly: {
    windowMs: DEFAULT_WINDOW_MS,
    max: 200,
  },

  // Write endpoints (more restrictive)
  write: {
    windowMs: DEFAULT_WINDOW_MS,
    max: 50,
  },

  // Heavy operations like import
  heavy: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
  },

  // Unmask operations (very restrictive)
  unmask: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
  },
};

/**
 * Create a rate limiter with custom options
 */
export function createRateLimiter(options?: Partial<Options>): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options?.windowMs || DEFAULT_WINDOW_MS,
    max: options?.max || DEFAULT_MAX_REQUESTS,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    },
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      if (req.auth?.user?.id) {
        return req.auth.user.id;
      }
      return req.ip || 'unknown';
    },
    skip: (_req: Request) => {
      // Skip rate limiting in development if configured
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
        return true;
      }
      return false;
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      });
    },
    ...options,
  });
}

/**
 * Standard rate limiter for API endpoints
 */
export const standardRateLimiter = createRateLimiter(rateLimitPresets.standard);

/**
 * Rate limiter for read-only endpoints
 */
export const readOnlyRateLimiter = createRateLimiter(rateLimitPresets.readOnly);

/**
 * Rate limiter for write endpoints
 */
export const writeRateLimiter = createRateLimiter(rateLimitPresets.write);

/**
 * Rate limiter for heavy operations
 */
export const heavyRateLimiter = createRateLimiter(rateLimitPresets.heavy);

/**
 * Rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimiter(rateLimitPresets.auth);

/**
 * Rate limiter for unmask operations
 */
export const unmaskRateLimiter = createRateLimiter(rateLimitPresets.unmask);

/**
 * Dynamic rate limiter based on user role
 */
export function dynamicRateLimiter(baseOptions: Partial<Options> = {}) {
  return createRateLimiter({
    ...baseOptions,
    max: (req: Request) => {
      // Higher limits for admin users
      if (req.auth?.user?.roles?.includes('admin')) {
        return (baseOptions.max as number || DEFAULT_MAX_REQUESTS) * 5;
      }

      // Higher limits for authenticated users
      if (req.auth?.isAuthenticated) {
        return (baseOptions.max as number || DEFAULT_MAX_REQUESTS) * 2;
      }

      return baseOptions.max as number || DEFAULT_MAX_REQUESTS;
    },
  });
}
