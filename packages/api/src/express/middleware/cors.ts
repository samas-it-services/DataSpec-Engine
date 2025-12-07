import cors, { CorsOptions } from 'cors';

/**
 * Default allowed origins
 */
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
];

/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGINS;

  if (envOrigins) {
    return envOrigins.split(',').map((origin) => origin.trim());
  }

  return defaultOrigins;
}

/**
 * CORS configuration
 */
export function corsMiddleware(options?: Partial<CorsOptions>) {
  const allowedOrigins = getAllowedOrigins();

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Response-Time',
      'Content-Disposition',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
    ...options,
  };

  return cors(corsOptions);
}

/**
 * Get CORS headers for manual response (useful for Edge Functions)
 */
export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();

  const allowOrigin =
    !origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')
      ? origin || '*'
      : '';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Request-ID',
    'Access-Control-Expose-Headers':
      'X-Request-ID, X-Response-Time, Content-Disposition',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle preflight OPTIONS request
 */
export function handlePreflight(origin?: string): {
  status: number;
  headers: Record<string, string>;
} {
  return {
    status: 204,
    headers: getCorsHeaders(origin),
  };
}
