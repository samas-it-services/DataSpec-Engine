import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  ApiException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  NotFoundException,
  InternalServerException,
} from '../../core/types';

/**
 * Error handler middleware for Express
 * Converts various error types to standardized API responses
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error for debugging
  const requestId = req.headers['x-request-id'] || 'unknown';
  console.error(`[${requestId}] Error:`, {
    name: err.name,
    message: err.message,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          issues: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Handle custom API exceptions
  if (err instanceof ApiException) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.toApiError(),
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Handle multer file upload errors
  if (err.name === 'MulterError') {
    const multerError = err as Error & { code: string };
    let message = 'File upload error';

    switch (multerError.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size exceeds the allowed limit';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
    }

    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message,
        details: { multerCode: multerError.code },
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Default to internal server error
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'An unexpected error occurred',
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Not found handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response) {
  const requestId = req.headers['x-request-id'] || 'unknown';

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * Response time middleware
 */
export function responseTimeMiddleware(_req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
}

// Re-export exception types for convenience
export {
  ApiException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  NotFoundException,
  InternalServerException,
};
