import {
  ExportRequest,
  ExportResult,
  HandlerContext,
  HandlerResult,
  ApiResponse,
  ExportSchema,
  AuthenticationException,
} from '../types';
import { ExportService, SpecService } from '../services';

export interface ExportHandlerDependencies {
  exportService: ExportService;
  specService: SpecService;
}

export class ExportHandler {
  private exportService: ExportService;
  private specService: SpecService;

  constructor(deps: ExportHandlerDependencies) {
    this.exportService = deps.exportService;
    this.specService = deps.specService;
  }

  /**
   * POST /dataspec/export
   * Export data based on spec definition
   */
  async export(
    request: ExportRequest,
    context: HandlerContext
  ): Promise<HandlerResult<ExportResult>> {
    const startTime = Date.now();

    try {
      // Require authentication for export
      if (!context.auth.isAuthenticated || !context.auth.user) {
        throw new AuthenticationException('Authentication required for data export');
      }

      // Validate request
      const validated = ExportSchema.parse(request);

      // Verify spec exists
      const specExists = await this.specService.specExists(validated.specId);
      if (!specExists) {
        return {
          status: 404,
          body: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Spec ${validated.specId} not found`,
            },
            meta: this.buildMeta(context, startTime),
          },
        };
      }

      // Execute export
      const result = await this.exportService.export(
        validated.specId,
        validated.format,
        validated.applyMasking,
        validated.filters,
        validated.fields,
        validated.limit,
        context.auth.user
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
