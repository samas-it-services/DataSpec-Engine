/**
 * DataSpec Engine - Core Type Definitions
 *
 * This file contains all the TypeScript types for the YAML specification format.
 * These types define the structure of DataSpec YAML files and provide type safety
 * throughout the engine.
 *
 * @packageDocumentation
 * @module @samas-it-services/dataspec-core
 */

// =============================================================================
// Entity Operation Mode & Permissions
// =============================================================================

/**
 * Operation modes for entities.
 * Controls which operations are allowed on an entity at the schema level.
 *
 * @example
 * ```typescript
 * const auditEntity: EntityDefinition = {
 *   operationMode: OperationMode.EXPORT_ONLY, // No imports allowed
 *   // ...
 * };
 * ```
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
 * Operations that can be performed on an entity.
 * Used for permission checking and UI display.
 */
export type EntityOperation = 'view' | 'import' | 'export';

/**
 * Role-based permissions for each operation.
 * Each array contains role names that are allowed to perform the operation.
 *
 * @example
 * ```typescript
 * const permissions: EntityPermissions = {
 *   viewRoles: ['admin', 'user', 'auditor'],
 *   importRoles: ['admin'],
 *   exportRoles: ['admin', 'auditor']
 * };
 * ```
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
 * Complete entity definition for the registry.
 * Represents a database entity that can be used with DataSpec import/export.
 *
 * @example
 * ```typescript
 * const transactionsEntity: EntityDefinition = {
 *   id: 'entity-123',
 *   name: 'transactions',
 *   displayName: 'Financial Transactions',
 *   tableName: 'transactions',
 *   operationMode: OperationMode.FULL,
 *   permissions: {
 *     viewRoles: ['admin', 'finance'],
 *     importRoles: ['admin'],
 *     exportRoles: ['admin', 'finance', 'auditor']
 *   },
 *   category: 'financial',
 *   enabled: true
 * };
 * ```
 */
export interface EntityDefinition {
  /** Unique identifier */
  id: string;
  /** Entity name (unique, snake_case) */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Description of the entity */
  description?: string;
  /** Database table name */
  tableName: string;
  /** Operation mode controlling allowed operations */
  operationMode: OperationMode;
  /** Role-based permissions */
  permissions: EntityPermissions;
  /** Category for grouping in UI (e.g., 'core', 'financial', 'audit', 'system') */
  category?: string;
  /** Sort order within category */
  sortOrder?: number;
  /** Icon name for UI */
  icon?: string;
  /** Whether the entity is enabled */
  enabled: boolean;
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Check if an operation is allowed by the operation mode.
 * This is a pure function that doesn't check roles, only mode restrictions.
 *
 * @param mode - The entity's operation mode
 * @param operation - The operation to check
 * @returns True if the operation mode permits this operation
 *
 * @example
 * ```typescript
 * isOperationAllowedByMode(OperationMode.EXPORT_ONLY, 'import'); // false
 * isOperationAllowedByMode(OperationMode.EXPORT_ONLY, 'export'); // true
 * ```
 */
export function isOperationAllowedByMode(
  mode: OperationMode,
  operation: EntityOperation
): boolean {
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
      return false;
  }
}

/**
 * Check if a user has permission for an operation on an entity.
 * This checks both the operation mode and the role-based permissions.
 *
 * @param entity - The entity definition to check against
 * @param operation - The operation to check permission for
 * @param userRoles - Array of roles the user has
 * @returns True if both mode and role permissions allow the operation
 *
 * @example
 * ```typescript
 * const canExport = hasEntityPermission(entity, 'export', ['finance', 'viewer']);
 * if (canExport) {
 *   // Show export button
 * }
 * ```
 */
export function hasEntityPermission(
  entity: EntityDefinition,
  operation: EntityOperation,
  userRoles: string[]
): boolean {
  // First check if the operation mode allows this operation
  if (!isOperationAllowedByMode(entity.operationMode, operation)) {
    return false;
  }

  // Get the roles allowed for this operation
  let allowedRoles: string[];
  switch (operation) {
    case 'view':
      allowedRoles = entity.permissions.viewRoles;
      break;
    case 'import':
      allowedRoles = entity.permissions.importRoles;
      break;
    case 'export':
      allowedRoles = entity.permissions.exportRoles;
      break;
    default:
      return false;
  }

  // Check if the user has any of the allowed roles
  return userRoles.some(role => allowedRoles.includes(role));
}

/**
 * Entity categories for grouping in the UI.
 *
 * @example
 * ```typescript
 * const entity: EntityDefinition = {
 *   category: EntityCategory.FINANCIAL,
 *   // ...
 * };
 * ```
 */
export enum EntityCategory {
  /** Core business entities */
  CORE = 'core',
  /** Financial and accounting entities */
  FINANCIAL = 'financial',
  /** Audit trail and log entities */
  AUDIT = 'audit',
  /** System configuration entities */
  SYSTEM = 'system',
  /** Junction/link tables for many-to-many relationships */
  LINK = 'link',
  /** Default category */
  GENERAL = 'general'
}

// =============================================================================
// Sensitivity & Data Classification
// =============================================================================

/**
 * Sensitivity levels for data classification.
 * Determines default masking behavior and access controls.
 *
 * @remarks
 * - `public`: No restrictions, visible to all
 * - `internal`: Company-internal only
 * - `confidential`: Need-to-know basis
 * - `secret`: Highly sensitive, restricted access
 * - `highly_restricted`: Maximum protection (PII, financial, medical)
 *
 * @example
 * ```typescript
 * const ssnColumn: ColumnMapping = {
 *   name: 'ssn',
 *   sensitivity: SensitivityLevel.HIGHLY_RESTRICTED,
 *   masking: { mode: MaskingMode.PARTIAL, visibleChars: 4, position: 'end' }
 * };
 * ```
 */
export enum SensitivityLevel {
  /** No restrictions - visible to all users */
  PUBLIC = 'public',
  /** Company-internal - not for external sharing */
  INTERNAL = 'internal',
  /** Need-to-know basis - restricted within company */
  CONFIDENTIAL = 'confidential',
  /** Highly sensitive - very restricted access */
  SECRET = 'secret',
  /** Maximum protection - PII, financial, medical data */
  HIGHLY_RESTRICTED = 'highly_restricted'
}

/**
 * Supported data types for columns.
 * Determines parsing and validation behavior.
 */
export enum DataType {
  /** General text string */
  STRING = 'string',
  /** Numeric value (float) */
  NUMBER = 'number',
  /** Integer value */
  INTEGER = 'integer',
  /** Decimal/currency value with precision */
  DECIMAL = 'decimal',
  /** Boolean true/false */
  BOOLEAN = 'boolean',
  /** Date without time */
  DATE = 'date',
  /** Date with time */
  DATETIME = 'datetime',
  /** Time without date */
  TIME = 'time',
  /** UUID/GUID format */
  UUID = 'uuid',
  /** JSON object */
  JSON = 'json',
  /** Array of values */
  ARRAY = 'array',
  /** Long text (unlimited length) */
  TEXT = 'text'
}

/**
 * Validation rule types for column values.
 */
export enum ValidationType {
  /** Value must be present and non-empty */
  REQUIRED = 'required',
  /** Value must be a valid UUID */
  UUID = 'uuid',
  /** Value must be a valid email address */
  EMAIL = 'email',
  /** Value must be a valid URL */
  URL = 'url',
  /** Value must match a regex pattern */
  REGEX = 'regex',
  /** Numeric value must be within a range */
  RANGE = 'range',
  /** String length must be within limits */
  LENGTH = 'length',
  /** Value must be one of specified values */
  ENUM = 'enum',
  /** Custom JavaScript validation function */
  CUSTOM = 'custom'
}

/**
 * Transformation types for modifying column values.
 */
export enum TransformationType {
  /** Remove leading/trailing whitespace */
  TRIM = 'trim',
  /** Convert to uppercase */
  UPPERCASE = 'uppercase',
  /** Convert to lowercase */
  LOWERCASE = 'lowercase',
  /** Capitalize first letter of each word */
  CAPITALIZE = 'capitalize',
  /** Parse string to date using format */
  PARSE_DATE = 'parse_date',
  /** Format date to string using format */
  FORMAT_DATE = 'format_date',
  /** Round to specified decimal places */
  ROUND = 'round',
  /** Round down to specified decimal places */
  FLOOR = 'floor',
  /** Round up to specified decimal places */
  CEIL = 'ceil',
  /** Extract value using regex capture group */
  REGEX_EXTRACT = 'regex_extract',
  /** Replace matches using regex pattern */
  REGEX_REPLACE = 'regex_replace',
  /** Split string into array by delimiter */
  SPLIT = 'split',
  /** Join array into string by delimiter */
  JOIN = 'join',
  /** Custom JavaScript transformation function */
  CUSTOM = 'custom'
}

/**
 * Masking modes for sensitive data.
 *
 * @remarks
 * - `full`: Replace entire value with replacement chars
 * - `partial`: Keep some characters visible (configurable)
 * - `regex`: Use regex pattern to mask specific parts
 * - `custom`: JavaScript function for complex masking
 *
 * @example
 * ```typescript
 * // Show last 4 digits of SSN: ***-**-1234
 * const ssnMasking: MaskingConfig = {
 *   mode: MaskingMode.PARTIAL,
 *   visibleChars: 4,
 *   position: 'end',
 *   replacement: '*'
 * };
 * ```
 */
export enum MaskingMode {
  /** Replace entire value with mask character(s) */
  FULL = 'full',
  /** Keep some characters visible at start or end */
  PARTIAL = 'partial',
  /** Use regex to mask specific patterns */
  REGEX = 'regex',
  /** Custom JavaScript masking function */
  CUSTOM = 'custom'
}

/**
 * Duplicate handling strategies for import operations.
 */
export enum DuplicateStrategy {
  /** Skip duplicate rows without error */
  SKIP = 'skip',
  /** Update existing rows (upsert behavior) */
  UPDATE = 'update',
  /** Fail import when duplicate found */
  ERROR = 'error'
}

/**
 * Lookup fallback strategies when foreign key lookup fails.
 */
export enum LookupFallback {
  /** Fail the entire row if lookup fails */
  ERROR = 'error',
  /** Skip the row if lookup fails */
  SKIP = 'skip',
  /** Use a default value if lookup fails */
  DEFAULT = 'default',
  /** Set the value to null if lookup fails */
  NULL = 'null'
}

// =============================================================================
// Validation Rules
// =============================================================================

/**
 * Base validation rule interface.
 * All specific validation types extend this.
 */
export interface ValidationRule {
  /** Type of validation */
  type: ValidationType;
  /** Custom error message when validation fails */
  message?: string;
}

/**
 * UUID format validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: uuid
 *     message: "Must be a valid UUID"
 * ```
 */
export interface UuidValidation extends ValidationRule {
  type: ValidationType.UUID;
}

/**
 * Email format validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: email
 *     message: "Invalid email address"
 * ```
 */
export interface EmailValidation extends ValidationRule {
  type: ValidationType.EMAIL;
}

/**
 * Regular expression validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: regex
 *     pattern: "^[A-Z]{2}\\d{6}$"
 *     flags: "i"
 *     message: "Must be 2 letters followed by 6 digits"
 * ```
 */
export interface RegexValidation extends ValidationRule {
  type: ValidationType.REGEX;
  /** Regex pattern to match */
  pattern: string;
  /** Regex flags (i, g, m) */
  flags?: string;
}

/**
 * Numeric range validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: range
 *     min: 0
 *     max: 100
 *     message: "Percentage must be between 0 and 100"
 * ```
 */
export interface RangeValidation extends ValidationRule {
  type: ValidationType.RANGE;
  /** Minimum allowed value (inclusive) */
  min?: number;
  /** Maximum allowed value (inclusive) */
  max?: number;
}

/**
 * String length validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: length
 *     min: 2
 *     max: 50
 *     message: "Name must be 2-50 characters"
 * ```
 */
export interface LengthValidation extends ValidationRule {
  type: ValidationType.LENGTH;
  /** Minimum length (inclusive) */
  min?: number;
  /** Maximum length (inclusive) */
  max?: number;
}

/**
 * Enumeration validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: enum
 *     values: ["active", "inactive", "pending"]
 *     message: "Status must be active, inactive, or pending"
 * ```
 */
export interface EnumValidation extends ValidationRule {
  type: ValidationType.ENUM;
  /** Array of allowed values */
  values: string[] | number[];
}

/**
 * Custom JavaScript validation rule.
 *
 * @example
 * ```yaml
 * validation:
 *   - type: custom
 *     script: "return parseFloat(value) > row.min_amount;"
 *     message: "Amount must exceed minimum"
 * ```
 */
export interface CustomValidation extends ValidationRule {
  type: ValidationType.CUSTOM;
  /** JavaScript code - receives {value, row, column} context */
  script: string;
}

/**
 * Union type for all validation rules.
 * Use this for arrays of mixed validation types.
 */
export type ValidationRuleUnion =
  | UuidValidation
  | EmailValidation
  | RegexValidation
  | RangeValidation
  | LengthValidation
  | EnumValidation
  | CustomValidation;

// =============================================================================
// Transformations
// =============================================================================

/**
 * Base transformation interface.
 * All specific transformation types extend this.
 */
export interface Transformation {
  /** Type of transformation */
  type: TransformationType;
}

/**
 * Trim whitespace transformation.
 */
export interface TrimTransform extends Transformation {
  type: TransformationType.TRIM;
}

/**
 * Case transformation (uppercase, lowercase, capitalize).
 */
export interface CaseTransform extends Transformation {
  type: TransformationType.UPPERCASE | TransformationType.LOWERCASE | TransformationType.CAPITALIZE;
}

/**
 * Parse string to date transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: parse_date
 *     format: "MM/DD/YYYY"
 *     timezone: "America/New_York"
 * ```
 */
export interface ParseDateTransform extends Transformation {
  type: TransformationType.PARSE_DATE;
  /** Date format string (moment.js/dayjs format) */
  format: string;
  /** IANA timezone name */
  timezone?: string;
}

/**
 * Format date to string transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: format_date
 *     format: "YYYY-MM-DD"
 *     timezone: "UTC"
 * ```
 */
export interface FormatDateTransform extends Transformation {
  type: TransformationType.FORMAT_DATE;
  /** Output date format string */
  format: string;
  /** IANA timezone name */
  timezone?: string;
}

/**
 * Numeric rounding transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: round
 *     decimals: 2
 * ```
 */
export interface RoundTransform extends Transformation {
  type: TransformationType.ROUND | TransformationType.FLOOR | TransformationType.CEIL;
  /** Number of decimal places */
  decimals?: number;
}

/**
 * Regex extraction transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: regex_extract
 *     pattern: "\\((\\d{3})\\)"
 *     capture_group: 1
 *     target_field: "area_code"
 * ```
 */
export interface RegexExtractTransform extends Transformation {
  type: TransformationType.REGEX_EXTRACT;
  /** Regex pattern with capture groups */
  pattern: string;
  /** Which capture group to extract (0=full match) */
  captureGroup?: number;
  /** Target field to store extracted value */
  targetField?: string;
  /** Regex flags */
  flags?: string;
}

/**
 * Regex replacement transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: regex_replace
 *     pattern: "[^0-9]"
 *     replacement: ""
 *     flags: "g"
 * ```
 */
export interface RegexReplaceTransform extends Transformation {
  type: TransformationType.REGEX_REPLACE;
  /** Regex pattern to match */
  pattern: string;
  /** Replacement string (can use $1, $2 for capture groups) */
  replacement: string;
  /** Regex flags */
  flags?: string;
}

/**
 * String split transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: split
 *     delimiter: ","
 *     index: 0
 * ```
 */
export interface SplitTransform extends Transformation {
  type: TransformationType.SPLIT;
  /** Delimiter to split on */
  delimiter: string;
  /** Index to select from result (-1 for last) */
  index?: number;
}

/**
 * Array join transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: join
 *     delimiter: ", "
 * ```
 */
export interface JoinTransform extends Transformation {
  type: TransformationType.JOIN;
  /** Delimiter for joining array elements */
  delimiter: string;
}

/**
 * Custom JavaScript transformation.
 *
 * @example
 * ```yaml
 * transform:
 *   - type: custom
 *     script: "return value.toUpperCase().replace(/\\s+/g, '_');"
 * ```
 */
export interface CustomTransform extends Transformation {
  type: TransformationType.CUSTOM;
  /** JavaScript code - receives {value, row, column} context */
  script: string;
}

/**
 * Union type for all transformations.
 * Use this for arrays of mixed transformation types.
 */
export type TransformationUnion =
  | TrimTransform
  | CaseTransform
  | ParseDateTransform
  | FormatDateTransform
  | RoundTransform
  | RegexExtractTransform
  | RegexReplaceTransform
  | SplitTransform
  | JoinTransform
  | CustomTransform;

// =============================================================================
// Masking Configuration
// =============================================================================

/**
 * Masking configuration for sensitive data.
 * Supports both simple (visibleChars + position) and explicit (partialStart/End) modes.
 *
 * @remarks
 * There are two ways to configure partial masking:
 *
 * 1. **Simple mode** (recommended): Use `visibleChars` + `position`
 *    - `visibleChars: 4, position: 'end'` shows last 4 chars: `****1234`
 *    - `visibleChars: 2, position: 'start'` shows first 2 chars: `AB******`
 *
 * 2. **Explicit mode**: Use `partialStart` and/or `partialEnd`
 *    - `partialStart: 2, partialEnd: 4` shows both: `AB****1234`
 *
 * @example Simple partial masking
 * ```typescript
 * const ssnMasking: MaskingConfig = {
 *   mode: MaskingMode.PARTIAL,
 *   visibleChars: 4,
 *   position: 'end',
 *   replacement: '*'
 * };
 * // "123-45-6789" -> "***-**-6789"
 * ```
 *
 * @example Explicit partial masking
 * ```typescript
 * const creditCardMasking: MaskingConfig = {
 *   mode: MaskingMode.PARTIAL,
 *   partialStart: 4,
 *   partialEnd: 4,
 *   replacement: '*'
 * };
 * // "4111111111111111" -> "4111********1111"
 * ```
 *
 * @example Email masking with regex
 * ```typescript
 * const emailMasking: MaskingConfig = {
 *   mode: MaskingMode.REGEX,
 *   regexPattern: '(?<=.{2}).(?=.*@)',
 *   replacement: '*'
 * };
 * // "john.doe@example.com" -> "jo**.***@example.com"
 * ```
 */
export interface MaskingConfig {
  /** Masking mode */
  mode: MaskingMode;
  /** Replacement character(s) for masked content */
  replacement?: string;

  // Simple partial masking (recommended for most cases)
  /**
   * Number of characters to keep visible.
   * Use with `position` to control which end stays visible.
   */
  visibleChars?: number;
  /**
   * Which end to keep visible: 'start' or 'end'.
   * Only used with `visibleChars`.
   * @default 'end'
   */
  position?: 'start' | 'end';

  // Explicit partial masking (for advanced cases)
  /** Number of characters visible at start */
  partialStart?: number;
  /** Number of characters visible at end */
  partialEnd?: number;

  // For regex/custom modes
  /** Regex pattern for mode='regex' */
  regexPattern?: string;
  /** JavaScript code for mode='custom' */
  customScript?: string;
}

/**
 * Type guard to check if masking uses simple partial mode.
 *
 * @param config - The masking configuration to check
 * @returns True if using visibleChars + position (simple mode)
 */
export function isSimplePartialMasking(config: MaskingConfig): boolean {
  return config.mode === MaskingMode.PARTIAL &&
         config.visibleChars !== undefined &&
         config.partialStart === undefined &&
         config.partialEnd === undefined;
}

/**
 * Type guard to check if masking uses explicit partial mode.
 *
 * @param config - The masking configuration to check
 * @returns True if using partialStart/partialEnd (explicit mode)
 */
export function isExplicitPartialMasking(config: MaskingConfig): boolean {
  return config.mode === MaskingMode.PARTIAL &&
         (config.partialStart !== undefined || config.partialEnd !== undefined);
}

// =============================================================================
// Lookup Configuration
// =============================================================================

/**
 * Lookup configuration for foreign key resolution.
 * Resolves values from reference tables during import.
 *
 * @remarks
 * Lookups translate human-readable values (like "North Zone") into
 * database foreign keys (like a UUID).
 *
 * @example Single key lookup
 * ```typescript
 * const zoneLookup: LookupConfig = {
 *   table: 'zones',
 *   key: 'name',
 *   returnField: 'id',
 *   fallback: LookupFallback.ERROR,
 *   cache: true,
 *   cacheTtl: 300
 * };
 * ```
 *
 * @example Composite key lookup
 * ```typescript
 * const subzoneLookup: LookupConfig = {
 *   table: 'subzones',
 *   key: ['zone_code', 'subzone_code'],
 *   fallback: LookupFallback.DEFAULT,
 *   defaultValue: null,
 *   cache: true
 * };
 * ```
 */
export interface LookupConfig {
  /** Target table to lookup */
  table: string;
  /** Column(s) to match against. String for single key, array for composite */
  key: string | string[];
  /** Source field to use for lookup value (if different from column name) */
  sourceField?: string;
  /** Column to return from lookup table (default: table's primary key) */
  returnField?: string;
  /** What to do if lookup fails */
  fallback: LookupFallback;
  /** Default value to use when fallback='default' */
  defaultValue?: unknown;
  /** Enable caching of lookup results */
  cache?: boolean;
  /** Cache TTL in seconds (only if cache=true) */
  cacheTtl?: number;
}

/**
 * Type guard to check if a lookup uses composite keys.
 *
 * @param config - The lookup configuration to check
 * @returns True if the lookup uses multiple keys
 */
export function isCompositeKeyLookup(config: LookupConfig): config is LookupConfig & { key: string[] } {
  return Array.isArray(config.key);
}

// =============================================================================
// Column Mapping
// =============================================================================

/**
 * Column mapping definition.
 * Defines how to map, validate, transform, and mask a single column.
 *
 * @example
 * ```typescript
 * const amountColumn: ColumnMapping = {
 *   name: 'amount',
 *   source: 'Transaction Amount',
 *   type: DataType.DECIMAL,
 *   required: true,
 *   sensitivity: SensitivityLevel.CONFIDENTIAL,
 *   validation: [
 *     { type: ValidationType.RANGE, min: 0, max: 1000000 }
 *   ],
 *   transform: [
 *     { type: TransformationType.ROUND, decimals: 2 }
 *   ],
 *   masking: {
 *     mode: MaskingMode.FULL,
 *     replacement: '***'
 *   },
 *   unmaskPermissions: ['finance_manager', 'auditor']
 * };
 * ```
 */
export interface ColumnMapping {
  /** Target column name in database */
  name: string;
  /** Source column name from CSV/Excel header */
  source: string;
  /** Data type for parsing and validation */
  type: DataType;
  /** Whether this field is required */
  required: boolean;
  /** Data sensitivity level */
  sensitivity: SensitivityLevel;
  /** Validation rules to apply */
  validation?: ValidationRuleUnion[];
  /** Transformations to apply (in order) */
  transform?: TransformationUnion[];
  /** Masking configuration */
  masking?: MaskingConfig;
  /** Roles that can view unmasked data */
  unmaskPermissions?: string[];
  /** Lookup configuration for foreign keys */
  lookup?: LookupConfig;
  /** Default value when source is empty */
  default?: unknown;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook definition for custom JavaScript logic.
 * Hooks allow extending import/export behavior at specific execution points.
 *
 * @example
 * ```typescript
 * const validateSsnHook: HookDefinition = {
 *   name: 'validate_ssn_format',
 *   field: 'ssn',
 *   script: `
 *     const cleaned = value.replace(/[^0-9]/g, '');
 *     if (cleaned.length !== 9) {
 *       throw new Error('SSN must be exactly 9 digits');
 *     }
 *     return true;
 *   `
 * };
 * ```
 */
export interface HookDefinition {
  /** Unique name for this hook (for logging/debugging) */
  name: string;
  /** Specific field this hook applies to (omit for row-level hooks) */
  field?: string;
  /** JavaScript code to execute */
  script: string;
}

// =============================================================================
// Import/Export Options
// =============================================================================

/**
 * Import options controlling import behavior.
 *
 * @example
 * ```typescript
 * const importOptions: ImportOptions = {
 *   duplicateStrategy: DuplicateStrategy.UPDATE,
 *   batchSize: 500,
 *   validateForeignKeys: true,
 *   autoGenerateIds: true
 * };
 * ```
 */
export interface ImportOptions {
  /** How to handle duplicate primary keys */
  duplicateStrategy: DuplicateStrategy;
  /** Number of rows per batch (affects memory usage) */
  batchSize: number;
  /** Validate that lookup references exist */
  validateForeignKeys: boolean;
  /** Auto-generate UUIDs for primary key if missing */
  autoGenerateIds: boolean;
}

/**
 * Export options controlling export behavior.
 *
 * @example
 * ```typescript
 * const exportOptions: ExportOptions = {
 *   applyMasking: true,
 *   includeAuditFields: false,
 *   format: 'csv'
 * };
 * ```
 */
export interface ExportOptions {
  /** Apply masking rules during export */
  applyMasking: boolean;
  /** Include created_at, updated_at, created_by fields */
  includeAuditFields: boolean;
  /** Output file format */
  format: 'csv' | 'excel' | 'json';
}

// =============================================================================
// Database Configuration
// =============================================================================

/**
 * Database configuration for the target table.
 *
 * @example
 * ```typescript
 * const dbConfig: DatabaseConfig = {
 *   table: 'transactions',
 *   primaryKey: 'id',
 *   schema: 'public'
 * };
 * ```
 */
export interface DatabaseConfig {
  /** Target database table name */
  table: string;
  /** Primary key column name */
  primaryKey: string;
  /** Database schema name (if not default) */
  schema?: string;
}

// =============================================================================
// Spec Metadata
// =============================================================================

/**
 * Specification metadata for identification and documentation.
 *
 * @example
 * ```typescript
 * const metadata: SpecMetadata = {
 *   name: 'transactions-monthly-import',
 *   description: 'Monthly bank transaction import from CSV exports',
 *   entity: 'transactions',
 *   author: 'Finance Team',
 *   tags: ['finance', 'monthly', 'automated'],
 *   version: '2.1.0'
 * };
 * ```
 */
export interface SpecMetadata {
  /** Unique specification name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Entity this spec belongs to */
  entity: string;
  /** Spec author or team */
  author?: string;
  /** Creation date (ISO 8601) */
  createdAt?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Spec version */
  version?: string;
}

// =============================================================================
// Hooks Configuration
// =============================================================================

/**
 * Hooks configuration containing all hook arrays.
 * All hook arrays are optional and can contain multiple hooks.
 *
 * @remarks
 * Hook execution order for import:
 * 1. `beforeValidateRow` - Modify row data before validation
 * 2. `validateField` - Custom field validation
 * 3. `beforeLookup` - Modify lookup parameters
 * 4. `performLookup` - Custom lookup logic
 * 5. `transformField` - Custom transformations
 * 6. `maskField` - Custom masking (export only)
 * 7. `beforeInsert` - Final modifications before DB insert
 * 8. `afterInsert` - Post-insert actions (logging, notifications)
 *
 * @example
 * ```typescript
 * const hooks: HooksConfig = {
 *   beforeValidateRow: [{
 *     name: 'normalize_row',
 *     script: 'row.email = row.email?.toLowerCase(); return row;'
 *   }],
 *   afterInsert: [{
 *     name: 'audit_log',
 *     script: 'console.log(`Inserted row ${row.id}`);'
 *   }]
 * };
 * ```
 */
export interface HooksConfig {
  /** Before row validation (can modify row) */
  beforeValidateRow?: HookDefinition[];
  /** Custom field validation */
  validateField?: HookDefinition[];
  /** Before lookup execution */
  beforeLookup?: HookDefinition[];
  /** Custom lookup logic */
  performLookup?: HookDefinition[];
  /** Custom field transformation */
  transformField?: HookDefinition[];
  /** Custom masking logic */
  maskField?: HookDefinition[];
  /** Custom unmasking logic */
  unmaskField?: HookDefinition[];
  /** Before database insert */
  beforeInsert?: HookDefinition[];
  /** After successful insert */
  afterInsert?: HookDefinition[];
}

// =============================================================================
// Complete DataSpec Definition
// =============================================================================

/**
 * Complete DataSpec definition.
 * This is the root type that represents a complete YAML spec file.
 *
 * @example
 * ```typescript
 * const spec: DataSpecDefinition = {
 *   version: '1.0',
 *   metadata: {
 *     name: 'transactions-import',
 *     entity: 'transactions',
 *     description: 'Import bank transactions'
 *   },
 *   database: {
 *     table: 'transactions',
 *     primaryKey: 'id'
 *   },
 *   columns: [
 *     {
 *       name: 'id',
 *       source: 'Transaction ID',
 *       type: DataType.UUID,
 *       required: true,
 *       sensitivity: SensitivityLevel.INTERNAL
 *     },
 *     {
 *       name: 'amount',
 *       source: 'Amount',
 *       type: DataType.DECIMAL,
 *       required: true,
 *       sensitivity: SensitivityLevel.CONFIDENTIAL,
 *       transform: [{ type: TransformationType.ROUND, decimals: 2 }]
 *     }
 *   ],
 *   importOptions: {
 *     duplicateStrategy: DuplicateStrategy.SKIP,
 *     batchSize: 100,
 *     validateForeignKeys: true,
 *     autoGenerateIds: false
 *   }
 * };
 * ```
 */
export interface DataSpecDefinition {
  /** Spec format version (e.g., '1.0') */
  version: string;
  /** Specification metadata */
  metadata: SpecMetadata;
  /** Database configuration */
  database: DatabaseConfig;
  /** Column mappings */
  columns: ColumnMapping[];
  /** Custom hooks */
  hooks?: HooksConfig;
  /** Import behavior options */
  importOptions?: ImportOptions;
  /** Export behavior options */
  exportOptions?: ExportOptions;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a validation rule is a regex validation.
 *
 * @param rule - The validation rule to check
 * @returns True if the rule is a RegexValidation
 */
export function isRegexValidation(rule: ValidationRuleUnion): rule is RegexValidation {
  return rule.type === ValidationType.REGEX;
}

/**
 * Type guard to check if a validation rule is a custom validation.
 *
 * @param rule - The validation rule to check
 * @returns True if the rule is a CustomValidation
 */
export function isCustomValidation(rule: ValidationRuleUnion): rule is CustomValidation {
  return rule.type === ValidationType.CUSTOM;
}

/**
 * Type guard to check if a transformation is a custom transformation.
 *
 * @param transform - The transformation to check
 * @returns True if the transformation is a CustomTransform
 */
export function isCustomTransformation(transform: TransformationUnion): transform is CustomTransform {
  return transform.type === TransformationType.CUSTOM;
}

/**
 * Type guard to check if a transformation is a date-related transformation.
 *
 * @param transform - The transformation to check
 * @returns True if the transformation is date-related
 */
export function isDateTransformation(transform: TransformationUnion): transform is ParseDateTransform | FormatDateTransform {
  return transform.type === TransformationType.PARSE_DATE ||
         transform.type === TransformationType.FORMAT_DATE;
}
