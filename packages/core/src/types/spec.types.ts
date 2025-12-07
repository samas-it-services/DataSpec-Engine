/**
 * DataSpec Engine - Core Type Definitions
 *
 * This file contains all the TypeScript types for the YAML specification format.
 * These types define the structure of DataSpec YAML files and provide type safety
 * throughout the engine.
 */

/**
 * Sensitivity levels for data classification
 */
export enum SensitivityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
  HIGHLY_RESTRICTED = 'highly_restricted'
}

/**
 * Supported data types for columns
 */
export enum DataType {
  STRING = 'string',
  NUMBER = 'number',
  INTEGER = 'integer',
  DECIMAL = 'decimal',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  TIME = 'time',
  UUID = 'uuid',
  JSON = 'json',
  ARRAY = 'array',
  TEXT = 'text'
}

/**
 * Validation rule types
 */
export enum ValidationType {
  REQUIRED = 'required',
  UUID = 'uuid',
  EMAIL = 'email',
  URL = 'url',
  REGEX = 'regex',
  RANGE = 'range',
  LENGTH = 'length',
  ENUM = 'enum',
  CUSTOM = 'custom'
}

/**
 * Transformation types
 */
export enum TransformationType {
  TRIM = 'trim',
  UPPERCASE = 'uppercase',
  LOWERCASE = 'lowercase',
  CAPITALIZE = 'capitalize',
  PARSE_DATE = 'parse_date',
  FORMAT_DATE = 'format_date',
  ROUND = 'round',
  FLOOR = 'floor',
  CEIL = 'ceil',
  REGEX_EXTRACT = 'regex_extract',
  REGEX_REPLACE = 'regex_replace',
  SPLIT = 'split',
  JOIN = 'join',
  CUSTOM = 'custom'
}

/**
 * Masking modes
 */
export enum MaskingMode {
  FULL = 'full',
  PARTIAL = 'partial',
  REGEX = 'regex',
  CUSTOM = 'custom'
}

/**
 * Duplicate handling strategies
 */
export enum DuplicateStrategy {
  SKIP = 'skip',
  UPDATE = 'update',
  ERROR = 'error'
}

/**
 * Lookup fallback strategies
 */
export enum LookupFallback {
  ERROR = 'error',
  SKIP = 'skip',
  DEFAULT = 'default',
  NULL = 'null'
}

/**
 * Base validation rule interface
 */
export interface ValidationRule {
  type: ValidationType;
  message?: string;
}

/**
 * UUID validation rule
 */
export interface UuidValidation extends ValidationRule {
  type: ValidationType.UUID;
}

/**
 * Email validation rule
 */
export interface EmailValidation extends ValidationRule {
  type: ValidationType.EMAIL;
}

/**
 * Regex validation rule
 */
export interface RegexValidation extends ValidationRule {
  type: ValidationType.REGEX;
  pattern: string;
  flags?: string;
}

/**
 * Range validation rule
 */
export interface RangeValidation extends ValidationRule {
  type: ValidationType.RANGE;
  min?: number;
  max?: number;
}

/**
 * Length validation rule
 */
export interface LengthValidation extends ValidationRule {
  type: ValidationType.LENGTH;
  min?: number;
  max?: number;
}

/**
 * Enum validation rule
 */
export interface EnumValidation extends ValidationRule {
  type: ValidationType.ENUM;
  values: string[] | number[];
}

/**
 * Custom validation rule with JavaScript code
 */
export interface CustomValidation extends ValidationRule {
  type: ValidationType.CUSTOM;
  script: string;
}

/**
 * Union type for all validation rules
 */
export type ValidationRuleUnion =
  | UuidValidation
  | EmailValidation
  | RegexValidation
  | RangeValidation
  | LengthValidation
  | EnumValidation
  | CustomValidation;

/**
 * Base transformation interface
 */
export interface Transformation {
  type: TransformationType;
}

/**
 * Trim transformation
 */
export interface TrimTransform extends Transformation {
  type: TransformationType.TRIM;
}

/**
 * Case transformation (uppercase, lowercase, capitalize)
 */
export interface CaseTransform extends Transformation {
  type: TransformationType.UPPERCASE | TransformationType.LOWERCASE | TransformationType.CAPITALIZE;
}

/**
 * Date parsing transformation
 */
export interface ParseDateTransform extends Transformation {
  type: TransformationType.PARSE_DATE;
  format: string;
  timezone?: string;
}

/**
 * Date formatting transformation
 */
export interface FormatDateTransform extends Transformation {
  type: TransformationType.FORMAT_DATE;
  format: string;
  timezone?: string;
}

/**
 * Numeric rounding transformation
 */
export interface RoundTransform extends Transformation {
  type: TransformationType.ROUND | TransformationType.FLOOR | TransformationType.CEIL;
  decimals?: number;
}

/**
 * Regex extraction transformation
 */
export interface RegexExtractTransform extends Transformation {
  type: TransformationType.REGEX_EXTRACT;
  pattern: string;
  captureGroup?: number;
  targetField?: string;
  flags?: string;
}

/**
 * Regex replacement transformation
 */
export interface RegexReplaceTransform extends Transformation {
  type: TransformationType.REGEX_REPLACE;
  pattern: string;
  replacement: string;
  flags?: string;
}

/**
 * String split transformation
 */
export interface SplitTransform extends Transformation {
  type: TransformationType.SPLIT;
  delimiter: string;
  index?: number;
}

/**
 * Array join transformation
 */
export interface JoinTransform extends Transformation {
  type: TransformationType.JOIN;
  delimiter: string;
}

/**
 * Custom transformation with JavaScript code
 */
export interface CustomTransform extends Transformation {
  type: TransformationType.CUSTOM;
  script: string;
}

/**
 * Union type for all transformations
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

/**
 * Masking configuration
 */
export interface MaskingConfig {
  mode: MaskingMode;
  replacement?: string;
  partialStart?: number;
  partialEnd?: number;
  regexPattern?: string;
  customScript?: string;
}

/**
 * Lookup configuration
 */
export interface LookupConfig {
  table: string;
  key: string | string[];
  sourceField?: string;
  fallback: LookupFallback;
  defaultValue?: any;
  cache?: boolean;
}

/**
 * Column mapping definition
 */
export interface ColumnMapping {
  name: string;
  source: string;
  type: DataType;
  required: boolean;
  sensitivity: SensitivityLevel;
  validation?: ValidationRuleUnion[];
  transform?: TransformationUnion[];
  masking?: MaskingConfig;
  unmaskPermissions?: string[];
  lookup?: LookupConfig;
  default?: any;
}

/**
 * Hook definition
 */
export interface HookDefinition {
  name: string;
  field?: string;
  script: string;
}

/**
 * Import options
 */
export interface ImportOptions {
  duplicateStrategy: DuplicateStrategy;
  batchSize: number;
  validateForeignKeys: boolean;
  autoGenerateIds: boolean;
}

/**
 * Export options
 */
export interface ExportOptions {
  applyMasking: boolean;
  includeAuditFields: boolean;
  format: 'csv' | 'excel' | 'json';
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  table: string;
  primaryKey: string;
  schema?: string;
}

/**
 * Spec metadata
 */
export interface SpecMetadata {
  name: string;
  description?: string;
  entity: string;
  author?: string;
  createdAt?: string;
  tags?: string[];
  version?: string;
}

/**
 * Hooks configuration
 */
export interface HooksConfig {
  beforeValidateRow?: HookDefinition[];
  validateField?: HookDefinition[];
  beforeLookup?: HookDefinition[];
  performLookup?: HookDefinition[];
  transformField?: HookDefinition[];
  maskField?: HookDefinition[];
  unmaskField?: HookDefinition[];
  beforeInsert?: HookDefinition[];
  afterInsert?: HookDefinition[];
}

/**
 * Complete DataSpec definition
 * This is the root type that represents a complete YAML spec
 */
export interface DataSpecDefinition {
  version: string;
  metadata: SpecMetadata;
  database: DatabaseConfig;
  columns: ColumnMapping[];
  hooks?: HooksConfig;
  importOptions?: ImportOptions;
  exportOptions?: ExportOptions;
}
