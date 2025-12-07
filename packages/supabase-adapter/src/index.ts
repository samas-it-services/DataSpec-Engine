/**
 * DataSpec Engine - Supabase Adapter
 *
 * Provides Supabase/PostgreSQL database integration for DataSpec Engine.
 */

// Main adapter
export {
  SupabaseAdapter,
  SupabaseAdapterOptions,
  DatabaseError
} from './SupabaseAdapter';

// RLS validation
export {
  RLSValidator,
  RLSCheckResult,
  TablePermissions
} from './RLSValidator';

// Audit logging
export {
  AuditLogger,
  AuditLogEntry,
  UnmaskAuditEntry,
  AuditLoggerOptions,
  AuditEventType
} from './AuditLogger';

// Re-export core types that adapter implementations need
export type {
  DatabaseAdapter,
  QueryBuilder,
  InsertResult,
  UpdateResult,
  DeleteResult,
  Transaction,
  OperationLog
} from '@samas-it-services/dataspec-core';
