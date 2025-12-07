import {
  ImportPreviewRequest,
  ImportExecuteRequest,
  PreviewResult,
  ImportResult,
  HandlerContext,
  HandlerResult,
  ApiResponse,
  ImportPreviewSchema,
  ImportExecuteSchema,
  AuthenticationException,
} from '../types';
import { ImportService, SpecService } from '../services';

export interface ImportHandlerDependencies {
  importService: ImportService;
  specService: SpecService;
}

export class ImportHandler {
  private importService: ImportService;
  private specService: SpecService;

  constructor(deps: ImportHandlerDependencies) {
    this.importService = deps.importService;
    this.specService = deps.specService;
  }

  /**
   * POST /dataspec/import/preview
   * Generate a preview of the import without database writes
   */
  async preview(
    request: ImportPreviewRequest,
    context: HandlerContext
  ): Promise<HandlerResult<PreviewResult>> {
    const startTime = Date.now();

    try {
      // Validate request
      const validated = ImportPreviewSchema.parse(request);

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

      // Generate preview
      const result = await this.importService.preview(
        validated.specId,
        validated.fileContent,
        validated.fileName,
        validated.maxRows,
        context.auth.user || undefined
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
   * POST /dataspec/import/execute
   * Execute a full import with database writes
   */
  async execute(
    request: ImportExecuteRequest,
    context: HandlerContext
  ): Promise<HandlerResult<ImportResult>> {
    const startTime = Date.now();

    try {
      // Require authentication for execute
      if (!context.auth.isAuthenticated || !context.auth.user) {
        throw new AuthenticationException('Authentication required for import execution');
      }

      // Validate request
      const validated = ImportExecuteSchema.parse(request);

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

      // Execute import
      const result = await this.importService.execute(
        validated.specId,
        validated.fileContent,
        validated.fileName,
        validated.batchSize,
        validated.skipValidation,
        context.auth.user
      );

      const status = result.success ? 200 : 207; // 207 Multi-Status for partial success

      return {
        status,
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
