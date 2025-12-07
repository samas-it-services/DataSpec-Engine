/**
 * Execution Types
 *
 * Types related to the execution of import/export operations
 */

import { DataSpecDefinition } from './spec.types';

/**
 * Execution mode
 */
export enum ExecutionMode {
  PREVIEW = 'preview',
  EXECUTE = 'execute'
}

/**
 * Operation status
 */
export enum OperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  SKIPPED = 'skipped'
}

/**
 * Row operation type
 */
export enum RowOperation {
  INSERT = 'insert',
  UPDATE = 'update',
  SKIP = 'skip'
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  value: any;
  rule: string;
  message: string;
}

/**
 * Transformation result
 */
export interface TransformationResult {
  field: string;
  originalValue: any;
  transformedValue: any;
  transformationType: string;
}

/**
 * Lookup result
 */
export interface LookupResult {
  field: string;
  lookupValue: any;
  foundRecord?: any;
  success: boolean;
  error?: string;
}

/**
 * Row validation result
 */
export interface RowValidationResult {
  rowIndex: number;
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Row processing result
 */
export interface RowProcessingResult {
  rowIndex: number;
  operation: RowOperation;
  status: OperationStatus;
  originalRow: Record<string, any>;
  transformedRow?: Record<string, any>;
  validationResult?: RowValidationResult;
  lookupResults?: LookupResult[];
  transformations?: TransformationResult[];
  errors?: ValidationError[];
  warnings?: string[];
  insertedId?: any;
}

/**
 * Preview result
 */
export interface PreviewResult {
  spec: DataSpecDefinition;
  totalRows: number;
  processedRows: RowProcessingResult[];
  summary: {
    valid: number;
    invalid: number;
    inserts: number;
    updates: number;
    skips: number;
  };
  errors: ValidationError[];
  warnings: string[];
  executionTime: number;
}

/**
 * Execute result
 */
export interface ExecuteResult {
  spec: DataSpecDefinition;
  totalRows: number;
  processedRows: RowProcessingResult[];
  summary: {
    successful: number;
    failed: number;
    skipped: number;
    inserts: number;
    updates: number;
  };
  errors: ValidationError[];
  warnings: string[];
  executionTime: number;
  executionId: string;
}

/**
 * Export result
 */
export interface ExportResult {
  spec: DataSpecDefinition;
  totalRows: number;
  format: 'csv' | 'excel' | 'json';
  data: any;
  maskingApplied: boolean;
  executionTime: number;
  executionId: string;
}

/**
 * Execution context passed to hooks
 */
export interface ExecutionContext {
  mode: ExecutionMode;
  spec: DataSpecDefinition;
  userId?: string;
  userRoles?: string[];
  correlationId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Database adapter query builder
 */
export interface QueryBuilder {
  select: string;
  filters: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  joins?: Array<{
    table: string;
    on: string;
  }>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
  offset?: number;
}

/**
 * Insert result from database
 */
export interface InsertResult {
  insertedCount: number;
  insertedIds: any[];
  errors?: Array<{
    row: Record<string, any>;
    error: string;
  }>;
}

/**
 * Update result from database
 */
export interface UpdateResult {
  updatedCount: number;
  errors?: Array<{
    row: Record<string, any>;
    error: string;
  }>;
}

/**
 * Delete result from database
 */
export interface DeleteResult {
  deletedCount: number;
  errors?: string[];
}

/**
 * Operation log for audit trail
 */
export interface OperationLog {
  operationType: 'import' | 'export' | 'unmask';
  specId?: string;
  specName?: string;
  entity: string;
  executionId: string;
  userId?: string;
  userRole?: string;
  status: OperationStatus;
  totalRecords: number;
  successfulRecords?: number;
  failedRecords?: number;
  executionTime: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  errors?: ValidationError[];
}

/**
 * Transaction interface
 */
export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

/**
 * Database adapter interface
 */
export interface DatabaseAdapter {
  find(table: string, query: QueryBuilder): Promise<any[]>;
  findOne(table: string, query: QueryBuilder): Promise<any | null>;
  insert(table: string, rows: any[]): Promise<InsertResult>;
  update(table: string, updates: any[], where: QueryBuilder): Promise<UpdateResult>;
  delete(table: string, where: QueryBuilder): Promise<DeleteResult>;
  lookup(table: string, key: string | string[], value: any | any[]): Promise<any | null>;
  transaction(callback: (trx: Transaction) => Promise<void>): Promise<void>;
  logOperation(operation: OperationLog): Promise<void>;
  setUser(userId: string, roles: string[]): void;
}
