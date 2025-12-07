import {
  MaskRequest,
  UnmaskRequest,
  MaskResult,
  UnmaskResult,
  HandlerContext,
  HandlerResult,
  ApiResponse,
  MaskSchema,
  UnmaskSchema,
  AuthenticationException,
  ValidationException,
  SensitivityLevel,
} from '../types';
import { MaskingService, SpecService } from '../services';

export interface MaskingHandlerDependencies {
  maskingService: MaskingService;
  specService: SpecService;
}

export class MaskingHandler {
  private maskingService: MaskingService;
  private specService: SpecService;

  constructor(deps: MaskingHandlerDependencies) {
    this.maskingService = deps.maskingService;
    this.specService = deps.specService;
  }

  /**
   * POST /dataspec/mask
   * Mask a field value
   */
  async mask(
    request: MaskRequest,
    context: HandlerContext
  ): Promise<HandlerResult<MaskResult>> {
    const startTime = Date.now();

    try {
      // Validate request
      const validated = MaskSchema.parse(request);

      // Get spec to determine field configuration
      const spec = await this.specService.getSpecById(validated.specId);
      if (!spec.yamlContent) {
        throw new ValidationException('Spec has no YAML content');
      }

      // Get field masking config from spec
      const fieldConfig = this.getFieldConfig(spec.yamlContent, validated.fieldName);

      // Apply masking
      const result = this.maskingService.maskWithResult(
        validated.value,
        fieldConfig.sensitivity,
        fieldConfig.mode,
        fieldConfig.options
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
   * POST /dataspec/unmask
   * Unmask a field value (requires authentication and permissions)
   */
  async unmask(
    request: UnmaskRequest,
    context: HandlerContext
  ): Promise<HandlerResult<UnmaskResult>> {
    const startTime = Date.now();

    try {
      // Require authentication for unmask
      if (!context.auth.isAuthenticated || !context.auth.user) {
        throw new AuthenticationException('Authentication required for unmasking');
      }

      // Validate request
      const validated = UnmaskSchema.parse(request);

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

      // Execute unmask
      const result = await this.maskingService.unmask(
        validated.specId,
        validated.fieldName,
        validated.maskedValue,
        validated.rowId,
        context.auth.user,
        validated.reason
      );

      return {
        status: result.success ? 200 : 403,
        body: this.buildSuccessResponse(result, context, startTime),
      };
    } catch (error) {
      return this.handleError(error, context, startTime);
    }
  }

  /**
   * Get field configuration from YAML content
   */
  private getFieldConfig(
    yamlContent: string,
    fieldName: string
  ): {
    sensitivity: SensitivityLevel;
    mode: 'full' | 'partial' | 'regex' | 'custom';
    options?: {
      visibleChars?: number;
      pattern?: string;
      replacement?: string;
    };
  } {
    // Simple regex-based extraction (in production, use proper YAML parser)
    const fieldPattern = new RegExp(
      `name:\\s*${fieldName}[\\s\\S]*?(?=\\n\\s*-\\s*name:|$)`,
      'i'
    );
    const fieldMatch = yamlContent.match(fieldPattern);

    if (!fieldMatch) {
      return {
        sensitivity: SensitivityLevel.PUBLIC,
        mode: 'full',
      };
    }

    const fieldSection = fieldMatch[0];

    // Extract sensitivity
    const sensitivityMatch = /sensitivity:\s*(\w+)/i.exec(fieldSection);
    const sensitivity = sensitivityMatch
      ? (sensitivityMatch[1].toLowerCase() as SensitivityLevel)
      : SensitivityLevel.PUBLIC;

    // Extract masking mode
    const modeMatch = /mode:\s*(\w+)/i.exec(fieldSection);
    const mode = modeMatch
      ? (modeMatch[1].toLowerCase() as 'full' | 'partial' | 'regex' | 'custom')
      : 'full';

    // Extract options
    const visibleCharsMatch = /visibleChars:\s*(\d+)/i.exec(fieldSection);
    const patternMatch = /pattern:\s*["']?([^"'\n]+)["']?/i.exec(fieldSection);
    const replacementMatch = /replacement:\s*["']?([^"'\n]+)["']?/i.exec(fieldSection);

    return {
      sensitivity,
      mode,
      options: {
        visibleChars: visibleCharsMatch ? parseInt(visibleCharsMatch[1], 10) : undefined,
        pattern: patternMatch ? patternMatch[1] : undefined,
        replacement: replacementMatch ? replacementMatch[1] : undefined,
      },
    };
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
