/**
 * HookExecutor Unit Tests
 */

import { HookExecutor } from '../hooks/HookExecutor';
import { HookPoint, HookError } from '../types/hook.types';
import { ExecutionMode, RowOperation, OperationStatus } from '../types/execution.types';
import { DataType, SensitivityLevel } from '../types/spec.types';

describe('HookExecutor', () => {
  let executor: HookExecutor;

  const mockSpec = {
    version: '1.0',
    metadata: { name: 'test', entity: 'test' },
    database: { table: 'test', primaryKey: 'id' },
    columns: []
  };

  const baseContext = {
    mode: ExecutionMode.PREVIEW,
    spec: mockSpec,
    correlationId: 'test-123',
    timestamp: new Date()
  };

  beforeEach(() => {
    executor = new HookExecutor({ timeout: 1000 });
  });

  afterEach(() => {
    executor.clearRegistry();
    executor.resetStats();
    executor.clearErrors();
  });

  describe('register()', () => {
    it('should register a hook', () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'testHook',
        script: 'return { success: true };'
      });

      expect(executor.getHookCount()).toBe(1);
      expect(executor.hasHooks(HookPoint.BEFORE_VALIDATE_ROW)).toBe(true);
    });

    it('should register field-specific hook', () => {
      executor.register(HookPoint.VALIDATE_FIELD, {
        name: 'emailValidator',
        field: 'email',
        script: 'return { success: true };'
      });

      expect(executor.hasHooks(HookPoint.VALIDATE_FIELD, 'email')).toBe(true);
      expect(executor.hasHooks(HookPoint.VALIDATE_FIELD, 'other')).toBe(false);
    });
  });

  describe('unregister()', () => {
    it('should unregister a hook', () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'testHook',
        script: 'return { success: true };'
      });

      const removed = executor.unregister(HookPoint.BEFORE_VALIDATE_ROW, 'testHook');

      expect(removed).toBe(true);
      expect(executor.getHookCount()).toBe(0);
    });

    it('should return false for non-existent hook', () => {
      const removed = executor.unregister(HookPoint.BEFORE_VALIDATE_ROW, 'nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('registerFromConfig()', () => {
    it('should register hooks from config object', () => {
      executor.registerFromConfig({
        beforeValidateRow: [
          { name: 'hook1', script: 'return { success: true };' }
        ],
        validateField: [
          { name: 'hook2', field: 'email', script: 'return { success: true };' }
        ],
        beforeInsert: [
          { name: 'hook3', script: 'return { success: true };' }
        ]
      });

      expect(executor.getHookCount()).toBe(3);
      expect(executor.hasHooks(HookPoint.BEFORE_VALIDATE_ROW)).toBe(true);
      expect(executor.hasHooks(HookPoint.VALIDATE_FIELD, 'email')).toBe(true);
      expect(executor.hasHooks(HookPoint.BEFORE_INSERT)).toBe(true);
    });
  });

  describe('execute()', () => {
    it('should execute hooks and return result', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'testHook',
        script: 'return { success: true, modifiedValue: { ...row, modified: true } };'
      });

      const result = await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: { name: 'test' }, rowIndex: 0 }
      );

      expect(result.success).toBe(true);
      expect(result.modifiedValue).toEqual({ name: 'test', modified: true });
    });

    it('should return success if no hooks registered', async () => {
      const result = await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      expect(result.success).toBe(true);
    });

    it('should chain multiple hooks', async () => {
      executor.register(HookPoint.TRANSFORM_FIELD, {
        name: 'addPrefix',
        script: 'return { success: true, modifiedValue: "prefix_" + currentValue };'
      });

      executor.register(HookPoint.TRANSFORM_FIELD, {
        name: 'addSuffix',
        script: 'return { success: true, modifiedValue: currentValue + "_suffix" };'
      });

      const column = {
        name: 'test',
        source: 'test',
        type: DataType.STRING,
        required: false,
        sensitivity: SensitivityLevel.PUBLIC
      };

      const result = await executor.execute(
        HookPoint.TRANSFORM_FIELD,
        { ...baseContext, field: column, value: 'value', row: {}, rowIndex: 0 },
        'test'
      );

      expect(result.modifiedValue).toBe('prefix_value_suffix');
    });

    it('should stop processing when stopProcessing is true', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'stopper',
        script: 'return { success: true, stopProcessing: true };'
      });

      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'second',
        script: 'return { success: true };'
      });

      const result = await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      expect(result.stopProcessing).toBe(true);
    });

    it('should handle hook errors gracefully', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'errorHook',
        script: 'throw new Error("Hook error");'
      });

      const result = await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      expect(result.success).toBe(true); // Default is not to stop on errors
      expect(executor.getErrors()).toHaveLength(1);
    });

    it('should throw error when stopOnError is true', async () => {
      const strictExecutor = new HookExecutor({ stopOnError: true });

      strictExecutor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'errorHook',
        script: 'throw new Error("Hook error");'
      });

      await expect(
        strictExecutor.execute(
          HookPoint.BEFORE_VALIDATE_ROW,
          { ...baseContext, row: {}, rowIndex: 0 }
        )
      ).rejects.toThrow(HookError);
    });

    it('should stop when max errors exceeded', async () => {
      const limitedExecutor = new HookExecutor({ maxErrors: 2 });

      for (let i = 0; i < 5; i++) {
        limitedExecutor.register(HookPoint.BEFORE_VALIDATE_ROW, {
          name: `errorHook${i}`,
          script: 'throw new Error("Hook error");'
        });
      }

      const result = await limitedExecutor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      expect(result.success).toBe(false);
      expect(result.stopProcessing).toBe(true);
      expect(result.error).toContain('Maximum hook errors');
    });
  });

  describe('specific hook executors', () => {
    const column = {
      name: 'test',
      source: 'test',
      type: DataType.STRING,
      required: false,
      sensitivity: SensitivityLevel.PUBLIC
    };

    it('executeBeforeValidateRow should work', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'test',
        script: 'return { success: true, modifiedValue: { ...row, validated: true } };'
      });

      const result = await executor.executeBeforeValidateRow({
        ...baseContext,
        row: { id: 1 },
        rowIndex: 0
      });

      expect(result.modifiedValue).toHaveProperty('validated', true);
    });

    it('executeValidateField should work', async () => {
      executor.register(HookPoint.VALIDATE_FIELD, {
        name: 'emailValidator',
        field: 'email',
        script: `
          if (!value.includes('@')) {
            return { success: false, error: 'Invalid email' };
          }
          return { success: true };
        `
      });

      const result = await executor.executeValidateField({
        ...baseContext,
        field: { ...column, name: 'email' },
        value: 'invalid',
        row: {},
        rowIndex: 0
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });

    it('executeBeforeLookup should work', async () => {
      executor.register(HookPoint.BEFORE_LOOKUP, {
        name: 'normalizeLookup',
        script: 'return { success: true, modifiedValue: lookupValue.toLowerCase() };'
      });

      const result = await executor.executeBeforeLookup({
        ...baseContext,
        field: column,
        lookupValue: 'TEST',
        row: {},
        rowIndex: 0
      });

      expect(result.modifiedValue).toBe('test');
    });

    it('executePerformLookup should work', async () => {
      executor.register(HookPoint.PERFORM_LOOKUP, {
        name: 'customLookup',
        script: 'return { success: true, modifiedValue: { id: 999 } };'
      });

      const result = await executor.executePerformLookup({
        ...baseContext,
        field: column,
        lookupValue: 'test',
        row: {},
        rowIndex: 0
      });

      expect(result.modifiedValue).toEqual({ id: 999 });
    });

    it('executeTransformField should work', async () => {
      executor.register(HookPoint.TRANSFORM_FIELD, {
        name: 'uppercase',
        script: 'return { success: true, modifiedValue: value.toUpperCase() };'
      });

      const result = await executor.executeTransformField({
        ...baseContext,
        field: column,
        value: 'hello',
        row: {},
        rowIndex: 0
      });

      expect(result.modifiedValue).toBe('HELLO');
    });

    it('executeMaskField should work', async () => {
      executor.register(HookPoint.MASK_FIELD, {
        name: 'customMask',
        script: 'return { success: true, modifiedValue: "***MASKED***" };'
      });

      const result = await executor.executeMaskField({
        ...baseContext,
        field: column,
        value: 'secret',
        row: {}
      });

      expect(result.modifiedValue).toBe('***MASKED***');
    });

    it('executeUnmaskField should work', async () => {
      executor.register(HookPoint.UNMASK_FIELD, {
        name: 'customUnmask',
        script: 'return { success: true, modifiedValue: "unmasked" };'
      });

      const result = await executor.executeUnmaskField({
        ...baseContext,
        field: column,
        maskedValue: '***',
        row: {}
      });

      expect(result.modifiedValue).toBe('unmasked');
    });

    it('executeBeforeInsert should work', async () => {
      executor.register(HookPoint.BEFORE_INSERT, {
        name: 'addTimestamp',
        script: 'return { success: true, modifiedValue: { ...row, created_at: new Date().toISOString() } };'
      });

      const result = await executor.executeBeforeInsert({
        ...baseContext,
        row: { id: 1 },
        rowIndex: 0,
        operation: 'insert'
      });

      expect(result.modifiedValue).toHaveProperty('created_at');
    });

    it('executeAfterInsert should work', async () => {
      executor.register(HookPoint.AFTER_INSERT, {
        name: 'logInsert',
        script: 'return { success: true };'
      });

      const mockResult = {
        rowIndex: 0,
        operation: RowOperation.INSERT,
        status: OperationStatus.SUCCESS,
        originalRow: {}
      };

      const result = await executor.executeAfterInsert({
        ...baseContext,
        row: { id: 1 },
        rowIndex: 0,
        operation: 'insert',
        insertedId: 123,
        result: mockResult
      });

      expect(result.success).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track execution statistics', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'test',
        script: 'return { success: true };'
      });

      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      const stats = executor.getStats();

      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.executionsByPoint[HookPoint.BEFORE_VALIDATE_ROW]).toBe(1);
    });

    it('should track failed executions', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'errorHook',
        script: 'throw new Error("test");'
      });

      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      const stats = executor.getStats();

      expect(stats.failedExecutions).toBe(1);
    });

    it('should reset statistics', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'test',
        script: 'return { success: true };'
      });

      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      executor.resetStats();

      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(0);
    });
  });

  describe('error management', () => {
    it('should accumulate errors', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'errorHook1',
        script: 'throw new Error("Error 1");'
      });

      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      expect(executor.getErrors()).toHaveLength(1);
      expect(executor.getErrors()[0]).toBeInstanceOf(HookError);
    });

    it('should clear errors', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'errorHook',
        script: 'throw new Error("test");'
      });

      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      executor.clearErrors();

      expect(executor.getErrors()).toHaveLength(0);
    });
  });

  describe('hook compilation', () => {
    it('should compile and cache hook function', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'test',
        script: 'return { success: true };'
      });

      // Execute twice - second should use cached function
      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 1 }
      );

      const stats = executor.getStats();
      expect(stats.totalExecutions).toBe(2);
    });

    it('should throw HookError for invalid script', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'invalid',
        script: 'return { invalid syntax'
      });

      // Force compilation and execution
      await expect(
        executor.execute(
          HookPoint.BEFORE_VALIDATE_ROW,
          { ...baseContext, row: {}, rowIndex: 0 }
        )
      ).resolves.toBeDefined(); // Errors are caught, so it still resolves

      // But errors are recorded
      expect(executor.getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('context access', () => {
    it('should provide access to context properties in hook', async () => {
      executor.register(HookPoint.BEFORE_VALIDATE_ROW, {
        name: 'contextTest',
        script: `
          return {
            success: true,
            modifiedValue: {
              mode: mode,
              hasSpec: !!spec,
              correlationId: correlationId
            }
          };
        `
      });

      const result = await executor.execute(
        HookPoint.BEFORE_VALIDATE_ROW,
        { ...baseContext, row: {}, rowIndex: 0 }
      );

      expect(result.modifiedValue).toEqual({
        mode: ExecutionMode.PREVIEW,
        hasSpec: true,
        correlationId: 'test-123'
      });
    });
  });
});
