import { Router, Request, Response } from 'express';
import { MaskingHandler } from '../../core/handlers';
import { HandlerContext, MaskRequest, UnmaskRequest } from '../../core/types';
import {
  asyncHandler,
  writeRateLimiter,
  unmaskRateLimiter,
  requireAuth,
} from '../middleware';

export function createMaskingRouter(handler: MaskingHandler): Router {
  const router = Router();

  /**
   * POST /dataspec/mask
   * Mask a field value
   */
  router.post(
    '/',
    writeRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const request: MaskRequest = {
        specId: req.body.specId,
        fieldName: req.body.fieldName,
        value: req.body.value,
      };

      const context = buildContext(req);
      const result = await handler.mask(request, context);

      res.status(result.status).json(result.body);
    })
  );

  /**
   * POST /dataspec/unmask
   * Unmask a field value (requires authentication)
   */
  router.post(
    '/unmask',
    requireAuth,
    unmaskRateLimiter,
    asyncHandler(async (req: Request, res: Response) => {
      const request: UnmaskRequest = {
        specId: req.body.specId,
        fieldName: req.body.fieldName,
        maskedValue: req.body.maskedValue,
        rowId: req.body.rowId,
        reason: req.body.reason,
      };

      const context = buildContext(req);
      const result = await handler.unmask(request, context);

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
