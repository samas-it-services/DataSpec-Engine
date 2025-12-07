import {
  GetSpecsRequest,
  GetSpecsResponse,
  ValidateSpecRequest,
  ValidateSpecResponse,
  SpecDefinition,
  HandlerContext,
  HandlerResult,
  ApiResponse,
  GetSpecsSchema,
  ValidateSpecSchema,
} from '../types';
import { SpecService, EntityService } from '../services';

export interface SpecsHandlerDependencies {
  specService: SpecService;
  entityService: EntityService;
}

export class SpecsHandler {
  private specService: SpecService;
  private entityService: EntityService;

  constructor(deps: SpecsHandlerDependencies) {
    this.specService = deps.specService;
    this.entityService = deps.entityService;
  }

  /**
   * GET /dataspec/specs
   * List all specs for an entity
   */
  async getSpecs(
    request: GetSpecsRequest,
    context: HandlerContext
  ): Promise<HandlerResult<GetSpecsResponse>> {
    const startTime = Date.now();

    try {
      // Validate request
      const validated = GetSpecsSchema.parse(request);

      // Verify entity exists
      const entityExists = await this.entityService.entityExists(validated.entityId);
      if (!entityExists) {
        return {
          status: 404,
          body: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Entity ${validated.entityId} not found`,
            },
            meta: this.buildMeta(context, startTime),
          },
        };
      }

      // Get specs
      const result = await this.specService.getSpecs(
        validated.entityId,
        validated.includeVersions
      );

      return {
        status: 200,
        body: this.buildSuccessResponse(result, context, startTime),
      };
    } catch (error) {
      return this.handleError(error, context, startTime);
    }
  }

  /**
   * GET /dataspec/specs/:id
   * Get a single spec by ID
   */
  async getSpec(
    specId: string,
    context: HandlerContext
  ): Promise<HandlerResult<SpecDefinition>> {
    const startTime = Date.now();

    try {
      const spec = await this.specService.getSpecById(specId);

      return {
        status: 200,
        body: this.buildSuccessResponse(spec, context, startTime),
      };
    } catch (error) {
      return this.handleError(error, context, startTime);
    }
  }

  /**
   * POST /dataspec/specs/validate
   * Validate a YAML spec
   */
  async validateSpec(
    request: ValidateSpecRequest,
    context: HandlerContext
  ): Promise<HandlerResult<ValidateSpecResponse>> {
    const startTime = Date.now();

    try {
      // Validate request
      const validated = ValidateSpecSchema.parse(request);

      // Validate YAML
      const result = this.specService.validateYaml(validated.yamlContent);

      return {
        status: result.valid ? 200 : 400,
        body: this.buildSuccessResponse(result, context, startTime),
      };
    } catch (error) {
      return this.handleError(error, context, startTime);
    }
  }

  /**
   * Build metadata object
   */
  private buildMeta(context: HandlerContext, startTime: number) {
    return {
      requestId: context.requestId,
      timestamp: context.timestamp.toISOString(),
      duration: Date.now() - startTime,
    };
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
      meta: this.buildMeta(context, startTime),
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
        meta: this.buildMeta(context, startTime),
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
