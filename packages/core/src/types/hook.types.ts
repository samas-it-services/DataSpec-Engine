/**
 * Hook Types
 *
 * Types related to the hook system and custom JavaScript execution
 */

import { ExecutionContext, RowProcessingResult } from './execution.types';
import { ColumnMapping } from './spec.types';

/**
 * Hook execution point
 */
export enum HookPoint {
  BEFORE_VALIDATE_ROW = 'beforeValidateRow',
  VALIDATE_FIELD = 'validateField',
  BEFORE_LOOKUP = 'beforeLookup',
  PERFORM_LOOKUP = 'performLookup',
  TRANSFORM_FIELD = 'transformField',
  MASK_FIELD = 'maskField',
  UNMASK_FIELD = 'unmaskField',
  BEFORE_INSERT = 'beforeInsert',
  AFTER_INSERT = 'afterInsert'
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
  success: boolean;
  modifiedValue?: any;
  error?: string;
  stopProcessing?: boolean;
}

/**
 * Hook context for beforeValidateRow
 */
export interface BeforeValidateRowContext extends ExecutionContext {
  row: Record<string, any>;
  rowIndex: number;
}

/**
 * Hook context for validateField
 */
export interface ValidateFieldContext extends ExecutionContext {
  field: ColumnMapping;
  value: any;
  row: Record<string, any>;
  rowIndex: number;
}

/**
 * Hook context for beforeLookup
 */
export interface BeforeLookupContext extends ExecutionContext {
  field: ColumnMapping;
  lookupValue: any;
  row: Record<string, any>;
  rowIndex: number;
}

/**
 * Hook context for performLookup
 */
export interface PerformLookupContext extends ExecutionContext {
  field: ColumnMapping;
  lookupValue: any;
  row: Record<string, any>;
  rowIndex: number;
}

/**
 * Hook context for transformField
 */
export interface TransformFieldContext extends ExecutionContext {
  field: ColumnMapping;
  value: any;
  row: Record<string, any>;
  rowIndex: number;
}

/**
 * Hook context for maskField
 */
export interface MaskFieldContext extends ExecutionContext {
  field: ColumnMapping;
  value: any;
  row: Record<string, any>;
}

/**
 * Hook context for unmaskField
 */
export interface UnmaskFieldContext extends ExecutionContext {
  field: ColumnMapping;
  maskedValue: any;
  row: Record<string, any>;
}

/**
 * Hook context for beforeInsert
 */
export interface BeforeInsertContext extends ExecutionContext {
  row: Record<string, any>;
  rowIndex: number;
  operation: 'insert' | 'update';
}

/**
 * Hook context for afterInsert
 */
export interface AfterInsertContext extends ExecutionContext {
  row: Record<string, any>;
  rowIndex: number;
  operation: 'insert' | 'update';
  insertedId?: any;
  result: RowProcessingResult;
}

/**
 * Union type for all hook contexts
 */
export type HookContext =
  | BeforeValidateRowContext
  | ValidateFieldContext
  | BeforeLookupContext
  | PerformLookupContext
  | TransformFieldContext
  | MaskFieldContext
  | UnmaskFieldContext
  | BeforeInsertContext
  | AfterInsertContext;

/**
 * Hook function signature
 */
export type HookFunction = (context: HookContext) => Promise<HookExecutionResult> | HookExecutionResult;

/**
 * Hook registry entry
 */
export interface HookRegistryEntry {
  name: string;
  point: HookPoint;
  field?: string;
  script: string;
  compiledFunction?: HookFunction;
}

/**
 * Hook error
 */
export class HookError extends Error {
  constructor(
    message: string,
    public hookName: string,
    public hookPoint: HookPoint,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'HookError';
  }
}
