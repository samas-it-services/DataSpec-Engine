import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';

// Middleware
import {
  corsMiddleware,
  authMiddleware,
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  responseTimeMiddleware,
} from './middleware';

// Routes
import {
  createEntitiesRouter,
  createSpecsRouter,
  createImportRouter,
  createExportRouter,
  createMaskingRouter,
} from './routes';

// Handlers
import {
  EntitiesHandler,
  SpecsHandler,
  ImportHandler,
  ExportHandler,
  MaskingHandler,
} from '../core/handlers';

// Services
import {
  EntityService,
  SpecService,
  ImportService,
  ExportService,
  MaskingService,
} from '../core/services';

// Types
import { DatabaseAdapter } from '../core/types';

export interface AppConfig {
  db: DatabaseAdapter;
}

/**
 * Create and configure Express application
 */
export function createApp(config: AppConfig): Application {
  const app = express();

  // ==========================================
  // Global Middleware
  // ==========================================

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS
  app.use(corsMiddleware());

  // Request ID
  app.use(requestIdMiddleware);

  // Response time tracking
  app.use(responseTimeMiddleware);

  // JSON body parsing
  app.use(express.json({ limit: '50mb' }));

  // URL-encoded body parsing
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Optional authentication (will be available but not required)
  app.use(authMiddleware({ required: false }));

  // ==========================================
  // Health Check
  // ==========================================

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    // In production, check database connection here
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });

  // ==========================================
  // Initialize Services
  // ==========================================

  const entityService = new EntityService({ db: config.db });
  const specService = new SpecService({ db: config.db });
  const maskingService = new MaskingService({ db: config.db });
  const importService = new ImportService({ db: config.db, specService });
  const exportService = new ExportService({
    db: config.db,
    specService,
    maskingService,
  });

  // ==========================================
  // Initialize Handlers
  // ==========================================

  const entitiesHandler = new EntitiesHandler({ entityService });
  const specsHandler = new SpecsHandler({ specService, entityService });
  const importHandler = new ImportHandler({ importService, specService });
  const exportHandler = new ExportHandler({ exportService, specService });
  const maskingHandler = new MaskingHandler({ maskingService, specService });

  // ==========================================
  // API Routes
  // ==========================================

  const apiRouter = express.Router();

  apiRouter.use('/entities', createEntitiesRouter(entitiesHandler));
  apiRouter.use('/specs', createSpecsRouter(specsHandler));
  apiRouter.use('/import', createImportRouter(importHandler));
  apiRouter.use('/export', createExportRouter(exportHandler));
  apiRouter.use('/mask', createMaskingRouter(maskingHandler));

  // Mount API routes
  app.use('/dataspec', apiRouter);

  // ==========================================
  // Error Handling
  // ==========================================

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Create a mock database adapter for development/testing
 */
export function createMockDbAdapter(): DatabaseAdapter {
  return {
    async find(_table: string, _query: unknown) {
      return [];
    },
    async findOne(_table: string, _query: unknown) {
      return null;
    },
    async insert(_table: string, rows: unknown[]) {
      return {
        success: true,
        insertedCount: rows.length,
        insertedIds: rows.map((_, i) => `mock-id-${i}`),
      };
    },
    async update(_table: string, _data: unknown, _where: unknown) {
      return { success: true, updatedCount: 0 };
    },
    async delete(_table: string, _where: unknown) {
      return { success: true, deletedCount: 0 };
    },
    async lookup(_table: string, _key: string, _value: unknown) {
      return null;
    },
    async lookupComposite(_table: string, _keys: string[], _values: unknown[]) {
      return null;
    },
    async transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>) {
      return callback(this);
    },
  };
}
