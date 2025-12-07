/**
 * DataSpec Engine Core
 *
 * Main entry point for the core engine package.
 * Exports all types, classes, and utilities.
 */

// Types
export * from './types';

// Parser
export { YAMLParser, ParseError, ValidationError } from './parser/YAMLParser';

// Transformers
export { FieldTransformer, TransformationError } from './transformers/FieldTransformer';

// Lookup
export { LookupResolver, LookupError, LookupStats } from './lookup/LookupResolver';

// Masking
export {
  MaskingEngine,
  MaskingError,
  RoleConfig,
  MaskingResult,
  UnmaskRequest
} from './masking/MaskingEngine';

// Hooks
export { HookExecutor, HookExecutionOptions, HookStats } from './hooks/HookExecutor';

// Executors
export { ImportExecutor, ImportOptions } from './executor/ImportExecutor';
export { ExportExecutor, ExportOptions } from './executor/ExportExecutor';

// Performance Utilities
export {
  LRUCache,
  StreamingCSVParser,
  BatchProcessor,
  PerformanceMonitor
} from './utils';
export type {
  LRUCacheOptions,
  LRUCacheStats,
  CSVParseOptions,
  CSVParseResult,
  CSVParseError,
  CSVChunk,
  BatchProcessorOptions,
  BatchResult,
  BatchError,
  PerformanceMetrics,
  OperationTiming
} from './utils';

// Additional Exporters
export {
  BaseExporter,
  XMLExporter,
  ParquetExporter,
  GoogleSheetsExporter,
  createExporter
} from './exporters';
export type {
  ExportConfig,
  ExportResult,
  ExportFormat,
  XMLExportOptions,
  ParquetExportOptions,
  ParquetSchema,
  GoogleSheetsExportOptions,
  GoogleCredentials,
  GoogleSheetsConfig
} from './exporters';
