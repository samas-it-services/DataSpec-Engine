import { z } from 'zod';

// ============================================================================
// Enums & Constants
// ============================================================================

export const SensitivityLevel = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  SECRET: 'secret',
  HIGHLY_RESTRICTED: 'highly_restricted',
} as const;

export type SensitivityLevel = (typeof SensitivityLevel)[keyof typeof SensitivityLevel];

export const ImportMode = {
  PREVIEW: 'preview',
  EXECUTE: 'execute',
} as const;

export type ImportMode = (typeof ImportMode)[keyof typeof ImportMode];

export const ExportFormat = {
  CSV: 'csv',
  JSON: 'json',
  XLSX: 'xlsx',
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const OperationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type OperationStatus = (typeof OperationStatus)[keyof typeof OperationStatus];

// ============================================================================
// Request Types
// ============================================================================

// Entity Requests
export interface GetEntitiesRequest {
  includeSpecCount?: boolean;
}

// Spec Requests
export interface GetSpecsRequest {
  entityId: string;
  includeVersions?: boolean;
}

export interface ValidateSpecRequest {
  yamlContent: string;
}

// Import Requests
export interface ImportPreviewRequest {
  specId: string;
  fileContent: string;
  fileName: string;
  maxRows?: number;
}

export interface ImportExecuteRequest {
  specId: string;
  fileContent: string;
  fileName: string;
  batchSize?: number;
  skipValidation?: boolean;
}

// Export Requests
export interface ExportRequest {
  specId: string;
  format: ExportFormat;
  applyMasking?: boolean;
  filters?: Record<string, unknown>;
  fields?: string[];
  limit?: number;
}

// Masking Requests
export interface MaskRequest {
  specId: string;
  fieldName: string;
  value: string;
}

export interface UnmaskRequest {
  specId: string;
  fieldName: string;
  maskedValue: string;
  rowId: string;
  reason?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  requestId?: string;
  timestamp: string;
  duration?: number;
}

// Entity Response Types
export interface EntityDefinition {
  id: string;
  name: string;
  description?: string;
  table: string;
  specCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetEntitiesResponse {
  entities: EntityDefinition[];
  total: number;
}

// Spec Response Types
export interface SpecDefinition {
  id: string;
  entityId: string;
  name: string;
  version: string;
  description?: string;
  yamlContent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetSpecsResponse {
  specs: SpecDefinition[];
  total: number;
}

export interface ValidateSpecResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  parsedSpec?: ParsedSpec;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ParsedSpec {
  version: string;
  entity: string;
  columns: ParsedColumn[];
  hooks?: string[];
}

export interface ParsedColumn {
  name: string;
  source: string;
  type: string;
  required: boolean;
  sensitivity?: SensitivityLevel;
}

// Import Response Types
export interface PreviewResult {
  rows: PreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowError[];
  columns: ColumnInfo[];
  warnings: string[];
}

export interface PreviewRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: FieldError[];
  isValid: boolean;
}

export interface RowError {
  rowIndex: number;
  errors: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ColumnInfo {
  name: string;
  sourceColumn: string;
  type: string;
  required: boolean;
  sensitivity?: SensitivityLevel;
  isMasked: boolean;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  errors: ImportError[];
  duration: number;
  batchId?: string;
}

export interface ImportError {
  rowIndex: number;
  field?: string;
  message: string;
  code: string;
  data?: Record<string, unknown>;
}

// Export Response Types
export interface ExportResult {
  success: boolean;
  data: string; // Base64 encoded content
  fileName: string;
  mimeType: string;
  rowCount: number;
  maskedFieldCount: number;
  format: ExportFormat;
}

// Masking Response Types
export interface MaskResult {
  maskedValue: string;
  sensitivity: SensitivityLevel;
  maskingMode: string;
}

export interface UnmaskResult {
  success: boolean;
  value?: string;
  auditId?: string;
}

// ============================================================================
// User & Auth Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

// ============================================================================
// Handler Context
// ============================================================================

export interface HandlerContext {
  auth: AuthContext;
  requestId: string;
  timestamp: Date;
  supabaseClient: unknown; // Will be typed properly when integrated
}

export interface HandlerResult<T> {
  status: number;
  body: ApiResponse<T>;
}

// ============================================================================
// Zod Schemas for Request Validation
// ============================================================================

export const GetEntitiesSchema = z.object({
  includeSpecCount: z.boolean().optional().default(false),
});

export const GetSpecsSchema = z.object({
  entityId: z.string().uuid('Invalid entity ID'),
  includeVersions: z.boolean().optional().default(false),
});

export const ValidateSpecSchema = z.object({
  yamlContent: z.string().min(1, 'YAML content is required'),
});

export const ImportPreviewSchema = z.object({
  specId: z.string().uuid('Invalid spec ID'),
  fileContent: z.string().min(1, 'File content is required'),
  fileName: z.string().min(1, 'File name is required'),
  maxRows: z.number().int().min(1).max(500).optional().default(200),
});

export const ImportExecuteSchema = z.object({
  specId: z.string().uuid('Invalid spec ID'),
  fileContent: z.string().min(1, 'File content is required'),
  fileName: z.string().min(1, 'File name is required'),
  batchSize: z.number().int().min(1).max(1000).optional().default(100),
  skipValidation: z.boolean().optional().default(false),
});

export const ExportSchema = z.object({
  specId: z.string().uuid('Invalid spec ID'),
  format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
  applyMasking: z.boolean().optional().default(true),
  filters: z.record(z.unknown()).optional(),
  fields: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100000).optional(),
});

export const MaskSchema = z.object({
  specId: z.string().uuid('Invalid spec ID'),
  fieldName: z.string().min(1, 'Field name is required'),
  value: z.string(),
});

export const UnmaskSchema = z.object({
  specId: z.string().uuid('Invalid spec ID'),
  fieldName: z.string().min(1, 'Field name is required'),
  maskedValue: z.string().min(1, 'Masked value is required'),
  rowId: z.string().min(1, 'Row ID is required'),
  reason: z.string().optional(),
});

// ============================================================================
// Database Types (for adapter interface)
// ============================================================================

export interface DatabaseAdapter {
  find(table: string, query: QueryOptions): Promise<unknown[]>;
  findOne(table: string, query: QueryOptions): Promise<unknown | null>;
  insert(table: string, rows: unknown[]): Promise<InsertResult>;
  update(table: string, data: unknown, where: QueryOptions): Promise<UpdateResult>;
  delete(table: string, where: QueryOptions): Promise<DeleteResult>;
  lookup(table: string, key: string, value: unknown): Promise<unknown | null>;
  lookupComposite(table: string, keys: string[], values: unknown[]): Promise<unknown | null>;
  transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T>;
}

export interface QueryOptions {
  select?: string[];
  filters?: QueryFilter[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';
  value: unknown;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface InsertResult {
  success: boolean;
  insertedCount: number;
  insertedIds?: string[];
  errors?: Array<{ index: number; error: string }>;
}

export interface UpdateResult {
  success: boolean;
  updatedCount: number;
}

export interface DeleteResult {
  success: boolean;
  deletedCount: number;
}

// ============================================================================
// Error Classes
// ============================================================================

export class ApiException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiException';
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class ValidationException extends ApiException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationException';
  }
}

export class AuthenticationException extends ApiException {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationException';
  }
}

export class AuthorizationException extends ApiException {
  constructor(message: string = 'Permission denied') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationException';
  }
}

export class NotFoundException extends ApiException {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with ID ${id} not found` : `${resource} not found`,
      404
    );
    this.name = 'NotFoundException';
  }
}

export class ConflictException extends ApiException {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictException';
  }
}

export class RateLimitException extends ApiException {
  constructor(retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', 429, { retryAfter });
    this.name = 'RateLimitException';
  }
}

export class InternalServerException extends ApiException {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR', message, 500);
    this.name = 'InternalServerException';
  }
}
