import { Router, Request, Response } from 'express';
import { ImportHandler } from '../../core/handlers';
import {
  HandlerContext,
  ImportPreviewRequest,
  ImportExecuteRequest,
} from '../../core/types';
import {
  asyncHandler,
  writeRateLimiter,
  heavyRateLimiter,
  requireAuth,
} from '../middleware';

export function createImportRouter(handler: ImportHandler): Router {
  const router = Router();

  /**
   * POST /dataspec/import/preview
   * Generate a preview of the import without database writes
   */
  router.post(
    '/preview',
    writeRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const request: ImportPreviewRequest = {
        specId: req.body.specId,
        fileContent: req.body.fileContent,
        fileName: req.body.fileName,
        maxRows: req.body.maxRows,
      };

      const context = buildContext(req);
      const result = await handler.preview(request, context);

      res.status(result.status).json(result.body);
    })
  );

  /**
   * POST /dataspec/import/execute
   * Execute a full import with database writes
   * Requires authentication
   */
  router.post(
    '/execute',
    requireAuth,
    heavyRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const request: ImportExecuteRequest = {
        specId: req.body.specId,
        fileContent: req.body.fileContent,
        fileName: req.body.fileName,
        batchSize: req.body.batchSize,
        skipValidation: req.body.skipValidation,
      };

      const context = buildContext(req);
      const result = await handler.execute(request, context);

      res.status(result.status).json(result.body);
    })
  );

  return router;
}

/**
 * Build handler context from Express request
 */
function buildContext(req: Request): HandlerContext {
  return {
    auth: req.auth || { user: null, isAuthenticated: false },
    requestId:
      (req.headers['x-request-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    supabaseClient: null,
  };
}
