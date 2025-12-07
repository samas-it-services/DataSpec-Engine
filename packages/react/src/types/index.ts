/**
 * React UI Types for DataSpec Engine
 */

// =============================================================================
// Operation Mode & Permissions (aligned with @samas-it-services/dataspec-core)
// =============================================================================

/**
 * Operation modes for entities
 * Controls which operations are allowed on an entity
 */
export enum OperationMode {
  /** All operations allowed: view, import, export */
  FULL = 'full',
  /** View and export only, no import (e.g., audit tables) */
  EXPORT_ONLY = 'export_only',
  /** View only, no import or export (e.g., system/reference tables) */
  VIEW_ONLY = 'view_only',
  /** View and import only, no export (e.g., staging tables) */
  IMPORT_ONLY = 'import_only'
}

/**
 * Entity categories for grouping
 */
export enum EntityCategory {
  CORE = 'core',
  FINANCIAL = 'financial',
  AUDIT = 'audit',
  SYSTEM = 'system',
  LINK = 'link',
  GENERAL = 'general'
}

/**
 * Role-based permissions for each operation
 */
export interface EntityPermissions {
  /** Roles allowed to view this entity in the UI */
  viewRoles: string[];
  /** Roles allowed to import data to this entity */
  importRoles: string[];
  /** Roles allowed to export data from this entity */
  exportRoles: string[];
}

/**
 * Check if an operation is allowed by the operation mode
 */
export function isOperationAllowedByMode(
  mode: OperationMode | undefined,
  operation: 'view' | 'import' | 'export'
): boolean {
  if (!mode) return true; // Default to full access if mode not set
  switch (mode) {
    case OperationMode.FULL:
      return true;
    case OperationMode.EXPORT_ONLY:
      return operation === 'view' || operation === 'export';
    case OperationMode.VIEW_ONLY:
      return operation === 'view';
    case OperationMode.IMPORT_ONLY:
      return operation === 'view' || operation === 'import';
    default:
      return true;
  }
}

/**
 * Check if a user has permission for an operation on an entity
 */
export function hasEntityPermission(
  entity: EntityDefinition | null,
  operation: 'view' | 'import' | 'export',
  userRoles: string[]
): boolean {
  if (!entity) return false;

  // Check operation mode first
  if (!isOperationAllowedByMode(entity.operationMode, operation)) {
    return false;
  }

  // If no permissions defined, default to allowing (backwards compatibility)
  if (!entity.permissions) return true;

  // Get allowed roles for this operation
  let allowedRoles: string[];
  switch (operation) {
    case 'view':
      allowedRoles = entity.permissions.viewRoles || [];
      break;
    case 'import':
      allowedRoles = entity.permissions.importRoles || [];
      break;
    case 'export':
      allowedRoles = entity.permissions.exportRoles || [];
      break;
    default:
      return false;
  }

  // Check if user has any of the allowed roles
  return userRoles.some(role => allowedRoles.includes(role));
}

// =============================================================================
// Re-export enums locally to avoid bundling issues
// =============================================================================

export enum OperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  SKIPPED = 'skipped'
}

export enum SensitivityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  HIGHLY_RESTRICTED = 'highly_restricted'
}

// DataSpecDefinition type (simplified for UI)
export interface DataSpecDefinition {
  version: string;
  metadata: {
    name: string;
    description?: string;
    entity: string;
    author?: string;
    created_at?: string;
    tags?: string[];
  };
  database: {
    table: string;
    primary_key: string;
  };
  columns: Array<{
    name: string;
    source: string;
    type: string;
    required?: boolean;
    sensitivity?: SensitivityLevel;
    masking?: {
      mode: string;
      replacement?: string;
    };
    validation?: any[];
    transform?: any[];
    lookup?: any;
    default?: any;
  }>;
  hooks?: Record<string, any[]>;
  import_options?: Record<string, any>;
  export_options?: Record<string, any>;
}

/**
 * Theme configuration
 */
export interface DataSpecTheme {
  primaryColor?: string;
  secondaryColor?: string;
  errorColor?: string;
  warningColor?: string;
  successColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  fontFamily?: string;
}

/**
 * Branding configuration
 */
export interface DataSpecBranding {
  logoUrl?: string;
  companyName?: string;
  supportEmail?: string;
}

/**
 * API configuration
 */
export interface DataSpecApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Provider configuration
 */
export interface DataSpecProviderConfig {
  api: DataSpecApiConfig;
  theme?: DataSpecTheme;
  branding?: DataSpecBranding;
  defaultEntity?: string;
  enableAuditLogging?: boolean;
}

/**
 * Entity definition for selector
 */
export interface EntityDefinition {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  table: string;
  icon?: string;
  specCount?: number;
  /** Operation mode controlling allowed operations */
  operationMode?: OperationMode;
  /** Role-based permissions */
  permissions?: EntityPermissions;
  /** Category for grouping in UI */
  category?: EntityCategory | string;
  /** Sort order within category */
  sortOrder?: number;
  /** Whether the entity is enabled */
  enabled?: boolean;
}

/**
 * Spec definition for selector
 */
export interface SpecDefinition {
  id: string;
  name: string;
  description?: string;
  entity: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  tags?: string[];
}

/**
 * File upload state
 */
export interface FileUploadState {
  file: File | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadProgress: number;
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

/**
 * Preview row
 */
export interface PreviewRow {
  rowNumber: number;
  data: Record<string, any>;
  maskedFields: string[];
  validationErrors: ValidationError[];
  operation: 'insert' | 'update' | 'skip';
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Preview result
 */
export interface PreviewResult {
  rows: PreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  insertCount: number;
  updateCount: number;
  skipCount: number;
  maskedFieldCount: number;
  spec: DataSpecDefinition;
}

/**
 * Import progress state
 */
export interface ImportProgress {
  status: OperationStatus;
  phase: 'idle' | 'validating' | 'transforming' | 'importing' | 'complete' | 'error';
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  currentBatch: number;
  totalBatches: number;
  startTime?: Date;
  endTime?: Date;
  errors: ImportError[];
}

/**
 * Import error
 */
export interface ImportError {
  rowNumber: number;
  field?: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  executionId: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  executionTimeMs: number;
  errors: ImportError[];
}

/**
 * Export options
 */
export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  applyMasking: boolean;
  includeHeaders: boolean;
  filters?: Record<string, any>;
  fields?: string[];
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  data: Blob | string;
  fileName: string;
  mimeType: string;
  rowCount: number;
  maskedFieldCount: number;
}

/**
 * Masked field display props
 */
export interface MaskedFieldProps {
  value: any;
  maskedValue: string;
  fieldName: string;
  sensitivityLevel: SensitivityLevel;
  canUnmask: boolean;
  onUnmask?: () => void;
}

/**
 * Context state
 */
export interface DataSpecContextState {
  // Configuration
  config: DataSpecProviderConfig;

  // Entities and specs
  entities: EntityDefinition[];
  specs: SpecDefinition[];
  selectedEntity: EntityDefinition | null;
  selectedSpec: SpecDefinition | null;

  // File upload
  fileUpload: FileUploadState;

  // Preview
  preview: PreviewResult | null;
  isPreviewLoading: boolean;

  // Import
  importProgress: ImportProgress;
  importResult: ImportResult | null;

  // User permissions
  userRoles: string[];
  canUnmask: boolean;

  // Computed permissions for selected entity
  /** Whether the user can view the selected entity (always true if entity is visible) */
  canViewSelected: boolean;
  /** Whether the user can import to the selected entity */
  canImportSelected: boolean;
  /** Whether the user can export from the selected entity */
  canExportSelected: boolean;

  // Loading states
  isLoadingEntities: boolean;
  isLoadingSpecs: boolean;

  // Error state
  error: string | null;
}

/**
 * Context actions
 */
export interface DataSpecContextActions {
  // Entity/Spec selection
  selectEntity: (entity: EntityDefinition | null) => void;
  selectSpec: (spec: SpecDefinition | null) => void;
  loadEntities: () => Promise<void>;
  loadSpecs: (entityId: string) => Promise<void>;

  // File operations
  setFile: (file: File | null) => void;
  clearFile: () => void;

  // Preview
  generatePreview: () => Promise<PreviewResult | null>;
  clearPreview: () => void;

  // Import
  executeImport: () => Promise<ImportResult | null>;
  cancelImport: () => void;
  resetImport: () => void;

  // Export
  executeExport: (options: ExportOptions) => Promise<ExportResult | null>;

  // Unmask
  unmaskField: (rowIndex: number, fieldName: string, reason?: string) => Promise<any>;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

/**
 * Full context type
 */
export type DataSpecContext = DataSpecContextState & DataSpecContextActions;
