/**
 * React UI Types for DataSpec Engine
 */

// Re-export enums locally to avoid bundling issues
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
  description?: string;
  table: string;
  icon?: string;
  specCount?: number;
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
