import { Router, Request, Response } from 'express';
import { EntitiesHandler } from '../../core/handlers';
import { HandlerContext, GetEntitiesRequest } from '../../core/types';
import { asyncHandler, readOnlyRateLimiter } from '../middleware';

export function createEntitiesRouter(handler: EntitiesHandler): Router {
  const router = Router();

  /**
   * GET /dataspec/entities
   * List all available entities
   */
  router.get(
    '/',
    readOnlyRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const request: GetEntitiesRequest = {
        includeSpecCount: req.query.includeSpecCount === 'true',
      };

      const context = buildContext(req);
      const result = await handler.getEntities(request, context);

      res.status(result.status).json(result.body);
    })
  );

  /**
   * GET /dataspec/entities/:id
   * Get a single entity by ID
   */
  router.get(
    '/:id',
    readOnlyRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const entityId = req.params.id;
      const context = buildContext(req);

      const result = await handler.getEntity(entityId, context);

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
    supabaseClient: null, // Will be injected from app context
  };
}
