import { Router, Request, Response } from 'express';
import { ExportHandler } from '../../core/handlers';
import { HandlerContext, ExportRequest, ExportFormat } from '../../core/types';
import { asyncHandler, writeRateLimiter, requireAuth } from '../middleware';

export function createExportRouter(handler: ExportHandler): Router {
  const router = Router();

  /**
   * POST /dataspec/export
   * Export data based on spec definition
   * Requires authentication
   */
  router.post(
    '/',
    requireAuth,
    writeRateLimiter,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const request: ExportRequest = {
        specId: req.body.specId,
        format: (req.body.format || 'csv') as ExportFormat,
        applyMasking: req.body.applyMasking !== false,
        filters: req.body.filters,
        fields: req.body.fields,
        limit: req.body.limit,
      };

      const context = buildContext(req);
      const result = await handler.export(request, context);

      // If successful, can either return JSON with base64 data or stream the file
      if (result.status === 200 && result.body.data) {
        const exportResult = result.body.data;

        // Check if client wants to download the file directly
        if (req.query.download === 'true') {
          const buffer = Buffer.from(exportResult.data, 'base64');

          res.setHeader('Content-Type', exportResult.mimeType);
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportResult.fileName}"`
          );
          res.setHeader('Content-Length', buffer.length);

          res.send(buffer);
          return;
        }
      }

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
