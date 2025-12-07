import {
  GetEntitiesRequest,
  GetEntitiesResponse,
  EntityDefinition,
  HandlerContext,
  HandlerResult,
  ApiResponse,
  GetEntitiesSchema,
} from '../types';
import { EntityService } from '../services';

export interface EntitiesHandlerDependencies {
  entityService: EntityService;
}

export class EntitiesHandler {
  private entityService: EntityService;

  constructor(deps: EntitiesHandlerDependencies) {
    this.entityService = deps.entityService;
  }

  /**
   * GET /dataspec/entities
   * List all available entities
   */
  async getEntities(
    request: GetEntitiesRequest,
    context: HandlerContext
  ): Promise<HandlerResult<GetEntitiesResponse>> {
    const startTime = Date.now();

    try {
      // Validate request
      const validated = GetEntitiesSchema.parse(request);

      // Get entities
      const result = await this.entityService.getEntities(validated.includeSpecCount);

      return {
        status: 200,
        body: this.buildSuccessResponse(result, context, startTime),
      };
    } catch (error) {
      return this.handleError(error, context, startTime);
    }
  }

  /**
   * GET /dataspec/entities/:id
   * Get a single entity by ID
   */
  async getEntity(
    entityId: string,
    context: HandlerContext
  ): Promise<HandlerResult<EntityDefinition>> {
    const startTime = Date.now();

    try {
      const entity = await this.entityService.getEntityById(entityId);

      return {
        status: 200,
        body: this.buildSuccessResponse(entity, context, startTime),
      };
    } catch (error) {
      return this.handleError(error, context, startTime);
    }
  }

  /**
   * Build success response with metadata
   */
  private buildSuccessResponse<T>(
    data: T,
    context: HandlerContext,
    startTime: number
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        requestId: context.requestId,
        timestamp: context.timestamp.toISOString(),
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Handle errors and build error response
   */
  private handleError(
    error: unknown,
    context: HandlerContext,
    startTime: number
  ): HandlerResult<never> {
    const { status, code, message, details } = this.parseError(error);

    return {
      status,
      body: {
        success: false,
        error: {
          code,
          message,
          details,
        },
        meta: {
          requestId: context.requestId,
          timestamp: context.timestamp.toISOString(),
          duration: Date.now() - startTime,
        },
      },
    };
  }

  /**
   * Parse error into response components
   */
  private parseError(error: unknown): {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (error && typeof error === 'object') {
      // Zod validation error
      if ('issues' in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> };
        return {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { issues: zodError.issues },
        };
      }

      // Custom API exception
      if ('statusCode' in error && 'code' in error) {
        const apiError = error as {
          statusCode: number;
          code: string;
          message: string;
          details?: Record<string, unknown>;
        };
        return {
          status: apiError.statusCode,
          code: apiError.code,
          message: apiError.message,
          details: apiError.details,
        };
      }

      // Standard Error
      if (error instanceof Error) {
        return {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: error.message,
        };
      }
    }

    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }
}
