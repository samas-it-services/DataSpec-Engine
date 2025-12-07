import { Router, Request, Response } from 'express';
import { SpecsHandler } from '../../core/handlers';
import { HandlerContext, GetSpecsRequest, ValidateSpecRequest } from '../../core/types';
import { asyncHandler, readOnlyRateLimiter, writeRateLimiter } from '../middleware';

export function createSpecsRouter(handler: SpecsHandler): Router {
  const router = Router();

  /**
   * GET /dataspec/specs
   * List all specs for an entity
   */
  router.get(
    '/',
    readOnlyRateLimiter,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const entityId = req.query.entityId as string;

      if (!entityId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'entityId query parameter is required',
          },
        });
        return;
      }

      const request: GetSpecsRequest = {
        entityId,
        includeVersions: req.query.includeVersions === 'true',
      };

      const context = buildContext(req);
      const result = await handler.getSpecs(request, context);

      res.status(result.status).json(result.body);
    })
  );

  /**
   * GET /dataspec/specs/:id
   * Get a single spec by ID
   */
  router.get(
    '/:id',
    readOnlyRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const specId = req.params.id;
      const context = buildContext(req);

      const result = await handler.getSpec(specId, context);

      res.status(result.status).json(result.body);
    })
  );

  /**
   * POST /dataspec/specs/validate
   * Validate a YAML spec
   */
  router.post(
    '/validate',
    writeRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const request: ValidateSpecRequest = {
        yamlContent: req.body.yamlContent,
      };

      const context = buildContext(req);
      const result = await handler.validateSpec(request, context);

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
