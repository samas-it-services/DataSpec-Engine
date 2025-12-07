/**
 * Hook Executor
 *
 * Executes JavaScript hooks at various points in the import/export pipeline.
 * Provides a sandboxed execution environment for custom logic.
 */

import {
  HookPoint,
  HookExecutionResult,
  HookContext,
  HookRegistryEntry,
  HookFunction,
  HookError,
  BeforeValidateRowContext,
  ValidateFieldContext,
  BeforeLookupContext,
  PerformLookupContext,
  TransformFieldContext,
  MaskFieldContext,
  UnmaskFieldContext,
  BeforeInsertContext,
  AfterInsertContext
} from '../types/hook.types';
import { HooksConfig, HookDefinition } from '../types/spec.types';

/**
 * Hook execution options
 */
export interface HookExecutionOptions {
  timeout?: number;
  maxErrors?: number;
  stopOnError?: boolean;
}

/**
 * Hook execution statistics
 */
export interface HookStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  executionsByPoint: Record<HookPoint, number>;
}

/**
 * Default hook execution options
 */
const DEFAULT_OPTIONS: HookExecutionOptions = {
  timeout: 5000,
  maxErrors: 10,
  stopOnError: false
};

/**
 * Hook Executor class
 */
export class HookExecutor {
  private registry: Map<string, HookRegistryEntry>;
  private stats: HookStats;
  private options: HookExecutionOptions;
  private errors: HookError[];

  constructor(options: HookExecutionOptions = {}) {
    this.registry = new Map();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.errors = [];
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsByPoint: {} as Record<HookPoint, number>
    };

    for (const point of Object.values(HookPoint)) {
      this.stats.executionsByPoint[point] = 0;
    }
  }

  /**
   * Register hooks from a DataSpec hooks configuration
   */
  registerFromConfig(hooksConfig: HooksConfig): void {
    const hookMappings: Array<{
      point: HookPoint;
      hooks?: HookDefinition[];
    }> = [
      { point: HookPoint.BEFORE_VALIDATE_ROW, hooks: hooksConfig.beforeValidateRow },
      { point: HookPoint.VALIDATE_FIELD, hooks: hooksConfig.validateField },
      { point: HookPoint.BEFORE_LOOKUP, hooks: hooksConfig.beforeLookup },
      { point: HookPoint.PERFORM_LOOKUP, hooks: hooksConfig.performLookup },
      { point: HookPoint.TRANSFORM_FIELD, hooks: hooksConfig.transformField },
      { point: HookPoint.MASK_FIELD, hooks: hooksConfig.maskField },
      { point: HookPoint.UNMASK_FIELD, hooks: hooksConfig.unmaskField },
      { point: HookPoint.BEFORE_INSERT, hooks: hooksConfig.beforeInsert },
      { point: HookPoint.AFTER_INSERT, hooks: hooksConfig.afterInsert }
    ];

    for (const { point, hooks } of hookMappings) {
      if (hooks) {
        for (const hook of hooks) {
          this.register(point, hook);
        }
      }
    }
  }

  /**
   * Register a single hook
   */
  register(point: HookPoint, definition: HookDefinition): void {
    const key = this.getRegistryKey(point, definition.name, definition.field);
    const entry: HookRegistryEntry = {
      name: definition.name,
      point,
      field: definition.field,
      script: definition.script
    };

    this.registry.set(key, entry);
  }

  /**
   * Unregister a hook
   */
  unregister(point: HookPoint, name: string, field?: string): boolean {
    const key = this.getRegistryKey(point, name, field);
    return this.registry.delete(key);
  }

  /**
   * Execute all hooks for a specific point
   */
  async execute(
    point: HookPoint,
    context: HookContext,
    field?: string
  ): Promise<HookExecutionResult> {
    const hooks = this.getHooksForPoint(point, field);

    if (hooks.length === 0) {
      return { success: true };
    }

    let result: HookExecutionResult = { success: true };
    let modifiedValue = this.getValueFromContext(context);

    for (const hook of hooks) {
      const startTime = Date.now();

      try {
        const hookResult = await this.executeHook(hook, context, modifiedValue);
        this.updateStats(point, Date.now() - startTime, true);

        if (hookResult.modifiedValue !== undefined) {
          modifiedValue = hookResult.modifiedValue;
          result.modifiedValue = modifiedValue;
        }

        if (hookResult.stopProcessing) {
          result.stopProcessing = true;
          break;
        }

        if (!hookResult.success) {
          result.success = false;
          result.error = hookResult.error;

          if (this.options.stopOnError) {
            break;
          }
        }
      } catch (error: any) {
        this.updateStats(point, Date.now() - startTime, false);

        const hookError = new HookError(
          `Hook execution failed: ${error.message}`,
          hook.name,
          point,
          error
        );

        this.errors.push(hookError);

        if (this.errors.length >= (this.options.maxErrors || 10)) {
          result.success = false;
          result.error = 'Maximum hook errors exceeded';
          result.stopProcessing = true;
          break;
        }

        if (this.options.stopOnError) {
          throw hookError;
        }
      }
    }

    return result;
  }

  /**
   * Execute a single hook
   */
  private async executeHook(
    entry: HookRegistryEntry,
    context: HookContext,
    currentValue: any
  ): Promise<HookExecutionResult> {
    const fn = this.compileHook(entry);

    const enrichedContext = {
      ...context,
      currentValue
    };

    const result = fn(enrichedContext as HookContext);

    if (result instanceof Promise) {
      return await Promise.race([
        result,
        this.createTimeoutPromise(entry.name)
      ]);
    }

    return result;
  }

  /**
   * Compile a hook script into a function
   */
  private compileHook(entry: HookRegistryEntry): HookFunction {
    if (entry.compiledFunction) {
      return entry.compiledFunction;
    }

    try {
      const fn = new Function('context', `
        "use strict";
        const {
          mode, spec, userId, userRoles, correlationId, timestamp, metadata,
          row, rowIndex, field, value, lookupValue, maskedValue, operation,
          insertedId, result, currentValue
        } = context;

        ${entry.script}
      `) as HookFunction;

      entry.compiledFunction = fn;
      return fn;
    } catch (error: any) {
      throw new HookError(
        `Failed to compile hook: ${error.message}`,
        entry.name,
        entry.point,
        error
      );
    }
  }

  /**
   * Create a timeout promise for hook execution
   */
  private createTimeoutPromise(hookName: string): Promise<HookExecutionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Hook "${hookName}" timed out after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });
  }

  /**
   * Get hooks for a specific execution point
   */
  private getHooksForPoint(point: HookPoint, field?: string): HookRegistryEntry[] {
    const hooks: HookRegistryEntry[] = [];

    for (const entry of this.registry.values()) {
      if (entry.point === point) {
        if (!entry.field || entry.field === field) {
          hooks.push(entry);
        }
      }
    }

    return hooks;
  }

  /**
   * Get registry key for a hook
   */
  private getRegistryKey(point: HookPoint, name: string, field?: string): string {
    return `${point}:${name}:${field || '*'}`;
  }

  /**
   * Extract value from context based on hook point
   */
  private getValueFromContext(context: HookContext): any {
    if ('value' in context) {
      return (context as ValidateFieldContext | TransformFieldContext).value;
    }
    if ('lookupValue' in context) {
      return (context as BeforeLookupContext | PerformLookupContext).lookupValue;
    }
    if ('maskedValue' in context) {
      return (context as UnmaskFieldContext).maskedValue;
    }
    if ('row' in context) {
      return (context as BeforeValidateRowContext).row;
    }
    return undefined;
  }

  /**
   * Update execution statistics
   */
  private updateStats(point: HookPoint, executionTime: number, success: boolean): void {
    this.stats.totalExecutions++;
    this.stats.executionsByPoint[point]++;

    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    const totalTime =
      this.stats.averageExecutionTime * (this.stats.totalExecutions - 1);
    this.stats.averageExecutionTime =
      (totalTime + executionTime) / this.stats.totalExecutions;
  }

  /**
   * Execute beforeValidateRow hooks
   */
  async executeBeforeValidateRow(
    context: BeforeValidateRowContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.BEFORE_VALIDATE_ROW, context);
  }

  /**
   * Execute validateField hooks
   */
  async executeValidateField(
    context: ValidateFieldContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.VALIDATE_FIELD, context, context.field.name);
  }

  /**
   * Execute beforeLookup hooks
   */
  async executeBeforeLookup(
    context: BeforeLookupContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.BEFORE_LOOKUP, context, context.field.name);
  }

  /**
   * Execute performLookup hooks
   */
  async executePerformLookup(
    context: PerformLookupContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.PERFORM_LOOKUP, context, context.field.name);
  }

  /**
   * Execute transformField hooks
   */
  async executeTransformField(
    context: TransformFieldContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.TRANSFORM_FIELD, context, context.field.name);
  }

  /**
   * Execute maskField hooks
   */
  async executeMaskField(
    context: MaskFieldContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.MASK_FIELD, context, context.field.name);
  }

  /**
   * Execute unmaskField hooks
   */
  async executeUnmaskField(
    context: UnmaskFieldContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.UNMASK_FIELD, context, context.field.name);
  }

  /**
   * Execute beforeInsert hooks
   */
  async executeBeforeInsert(
    context: BeforeInsertContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.BEFORE_INSERT, context);
  }

  /**
   * Execute afterInsert hooks
   */
  async executeAfterInsert(
    context: AfterInsertContext
  ): Promise<HookExecutionResult> {
    return this.execute(HookPoint.AFTER_INSERT, context);
  }

  /**
   * Get execution statistics
   */
  getStats(): HookStats {
    return { ...this.stats };
  }

  /**
   * Get accumulated errors
   */
  getErrors(): HookError[] {
    return [...this.errors];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsByPoint: {} as Record<HookPoint, number>
    };

    for (const point of Object.values(HookPoint)) {
      this.stats.executionsByPoint[point] = 0;
    }
  }

  /**
   * Clear all registered hooks
   */
  clearRegistry(): void {
    this.registry.clear();
  }

  /**
   * Check if any hooks are registered for a point
   */
  hasHooks(point: HookPoint, field?: string): boolean {
    return this.getHooksForPoint(point, field).length > 0;
  }

  /**
   * Get count of registered hooks
   */
  getHookCount(): number {
    return this.registry.size;
  }
}

export default HookExecutor;
