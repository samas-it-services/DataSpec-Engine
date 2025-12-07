/**
 * Audit Logger
 *
 * Provides comprehensive audit trail logging for DataSpec operations.
 * Tracks imports, exports, and sensitive data access.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { OperationStatus } from '@dataspec-engine/core';

/**
 * Audit event types
 */
export enum AuditEventType {
  IMPORT_STARTED = 'import_started',
  IMPORT_COMPLETED = 'import_completed',
  IMPORT_FAILED = 'import_failed',
  EXPORT_STARTED = 'export_started',
  EXPORT_COMPLETED = 'export_completed',
  EXPORT_FAILED = 'export_failed',
  DATA_UNMASKED = 'data_unmasked',
  SPEC_CREATED = 'spec_created',
  SPEC_UPDATED = 'spec_updated',
  SPEC_DELETED = 'spec_deleted',
  PERMISSION_DENIED = 'permission_denied',
  VALIDATION_FAILED = 'validation_failed'
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id?: string;
  eventType: AuditEventType;
  entityType: string;
  entityId?: string;
  specId?: string;
  specName?: string;
  executionId: string;
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
  ipAddress?: string;
  userAgent?: string;
  status: OperationStatus;
  recordsAffected?: number;
  executionTimeMs?: number;
  errorMessage?: string;
  errorDetails?: any;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Unmask audit entry
 */
export interface UnmaskAuditEntry {
  id?: string;
  fieldName: string;
  tableName: string;
  recordId: string;
  userId: string;
  userRoles: string[];
  reason?: string;
  approvedBy?: string;
  timestamp: Date;
  ipAddress?: string;
}

/**
 * Audit logger options
 */
export interface AuditLoggerOptions {
  operationsTable?: string;
  unmaskTable?: string;
  enableConsoleLogging?: boolean;
  retentionDays?: number;
}

/**
 * Audit Logger class
 */
export class AuditLogger {
  private operationsTable: string;
  private unmaskTable: string;
  private enableConsoleLogging: boolean;

  constructor(
    private client: SupabaseClient,
    options: AuditLoggerOptions = {}
  ) {
    this.operationsTable = options.operationsTable || 'dataspec_operation_logs';
    this.unmaskTable = options.unmaskTable || 'dataspec_unmask_logs';
    this.enableConsoleLogging = options.enableConsoleLogging || false;
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    if (this.enableConsoleLogging) {
      console.log(`[AUDIT] ${entry.eventType}:`, {
        entity: entry.entityType,
        executionId: entry.executionId,
        status: entry.status
      });
    }

    const dbEntry = {
      event_type: entry.eventType,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      spec_id: entry.specId,
      spec_name: entry.specName,
      execution_id: entry.executionId,
      user_id: entry.userId,
      user_email: entry.userEmail,
      user_roles: entry.userRoles,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      status: entry.status,
      records_affected: entry.recordsAffected,
      execution_time_ms: entry.executionTimeMs,
      error_message: entry.errorMessage,
      error_details: entry.errorDetails,
      metadata: entry.metadata,
      created_at: entry.createdAt.toISOString()
    };

    const { error } = await this.client
      .from(this.operationsTable)
      .insert(dbEntry);

    if (error) {
      console.error('Failed to write audit log:', error.message);
    }
  }

  /**
   * Log import started event
   */
  async logImportStarted(params: {
    entityType: string;
    specId?: string;
    specName?: string;
    executionId: string;
    userId?: string;
    totalRecords: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.IMPORT_STARTED,
      entityType: params.entityType,
      specId: params.specId,
      specName: params.specName,
      executionId: params.executionId,
      userId: params.userId,
      status: OperationStatus.SUCCESS,
      recordsAffected: params.totalRecords,
      metadata: params.metadata,
      createdAt: new Date()
    });
  }

  /**
   * Log import completed event
   */
  async logImportCompleted(params: {
    entityType: string;
    specId?: string;
    specName?: string;
    executionId: string;
    userId?: string;
    successfulRecords: number;
    failedRecords: number;
    executionTimeMs: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.IMPORT_COMPLETED,
      entityType: params.entityType,
      specId: params.specId,
      specName: params.specName,
      executionId: params.executionId,
      userId: params.userId,
      status: params.failedRecords > 0 ? OperationStatus.WARNING : OperationStatus.SUCCESS,
      recordsAffected: params.successfulRecords + params.failedRecords,
      executionTimeMs: params.executionTimeMs,
      metadata: {
        ...params.metadata,
        successfulRecords: params.successfulRecords,
        failedRecords: params.failedRecords
      },
      createdAt: new Date()
    });
  }

  /**
   * Log import failed event
   */
  async logImportFailed(params: {
    entityType: string;
    specId?: string;
    specName?: string;
    executionId: string;
    userId?: string;
    errorMessage: string;
    errorDetails?: any;
    executionTimeMs?: number;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.IMPORT_FAILED,
      entityType: params.entityType,
      specId: params.specId,
      specName: params.specName,
      executionId: params.executionId,
      userId: params.userId,
      status: OperationStatus.ERROR,
      errorMessage: params.errorMessage,
      errorDetails: params.errorDetails,
      executionTimeMs: params.executionTimeMs,
      createdAt: new Date()
    });
  }

  /**
   * Log export started event
   */
  async logExportStarted(params: {
    entityType: string;
    specId?: string;
    specName?: string;
    executionId: string;
    userId?: string;
    format: string;
    filters?: any;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.EXPORT_STARTED,
      entityType: params.entityType,
      specId: params.specId,
      specName: params.specName,
      executionId: params.executionId,
      userId: params.userId,
      status: OperationStatus.SUCCESS,
      metadata: {
        format: params.format,
        filters: params.filters
      },
      createdAt: new Date()
    });
  }

  /**
   * Log export completed event
   */
  async logExportCompleted(params: {
    entityType: string;
    specId?: string;
    specName?: string;
    executionId: string;
    userId?: string;
    recordsExported: number;
    maskingApplied: boolean;
    maskedFields?: string[];
    executionTimeMs: number;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.EXPORT_COMPLETED,
      entityType: params.entityType,
      specId: params.specId,
      specName: params.specName,
      executionId: params.executionId,
      userId: params.userId,
      status: OperationStatus.SUCCESS,
      recordsAffected: params.recordsExported,
      executionTimeMs: params.executionTimeMs,
      metadata: {
        maskingApplied: params.maskingApplied,
        maskedFields: params.maskedFields
      },
      createdAt: new Date()
    });
  }

  /**
   * Log data unmask event
   */
  async logUnmask(entry: UnmaskAuditEntry): Promise<void> {
    if (this.enableConsoleLogging) {
      console.log(`[AUDIT] Data Unmasked:`, {
        field: entry.fieldName,
        table: entry.tableName,
        recordId: entry.recordId,
        userId: entry.userId
      });
    }

    const dbEntry = {
      field_name: entry.fieldName,
      table_name: entry.tableName,
      record_id: entry.recordId,
      user_id: entry.userId,
      user_roles: entry.userRoles,
      reason: entry.reason,
      approved_by: entry.approvedBy,
      ip_address: entry.ipAddress,
      created_at: entry.timestamp.toISOString()
    };

    const { error } = await this.client
      .from(this.unmaskTable)
      .insert(dbEntry);

    if (error) {
      console.error('Failed to write unmask audit log:', error.message);
    }
  }

  /**
   * Log permission denied event
   */
  async logPermissionDenied(params: {
    entityType: string;
    operation: string;
    userId?: string;
    userRoles?: string[];
    requiredPermissions?: string[];
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.PERMISSION_DENIED,
      entityType: params.entityType,
      executionId: `perm-denied-${Date.now()}`,
      userId: params.userId,
      userRoles: params.userRoles,
      status: OperationStatus.ERROR,
      metadata: {
        operation: params.operation,
        requiredPermissions: params.requiredPermissions
      },
      createdAt: new Date()
    });
  }

  /**
   * Get recent audit logs
   */
  async getRecentLogs(params: {
    limit?: number;
    entityType?: string;
    userId?: string;
    eventType?: AuditEventType;
    since?: Date;
  }): Promise<AuditLogEntry[]> {
    let query = this.client
      .from(this.operationsTable)
      .select('*')
      .order('created_at', { ascending: false });

    if (params.limit) {
      query = query.limit(params.limit);
    }

    if (params.entityType) {
      query = query.eq('entity_type', params.entityType);
    }

    if (params.userId) {
      query = query.eq('user_id', params.userId);
    }

    if (params.eventType) {
      query = query.eq('event_type', params.eventType);
    }

    if (params.since) {
      query = query.gte('created_at', params.since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      specId: row.spec_id,
      specName: row.spec_name,
      executionId: row.execution_id,
      userId: row.user_id,
      userEmail: row.user_email,
      userRoles: row.user_roles,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      status: row.status,
      recordsAffected: row.records_affected,
      executionTimeMs: row.execution_time_ms,
      errorMessage: row.error_message,
      errorDetails: row.error_details,
      metadata: row.metadata,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get unmask logs for a specific field or user
   */
  async getUnmaskLogs(params: {
    limit?: number;
    fieldName?: string;
    tableName?: string;
    userId?: string;
    since?: Date;
  }): Promise<UnmaskAuditEntry[]> {
    let query = this.client
      .from(this.unmaskTable)
      .select('*')
      .order('created_at', { ascending: false });

    if (params.limit) {
      query = query.limit(params.limit);
    }

    if (params.fieldName) {
      query = query.eq('field_name', params.fieldName);
    }

    if (params.tableName) {
      query = query.eq('table_name', params.tableName);
    }

    if (params.userId) {
      query = query.eq('user_id', params.userId);
    }

    if (params.since) {
      query = query.gte('created_at', params.since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch unmask logs: ${error.message}`);
    }

    return (data || []).map(row => ({
      id: row.id,
      fieldName: row.field_name,
      tableName: row.table_name,
      recordId: row.record_id,
      userId: row.user_id,
      userRoles: row.user_roles,
      reason: row.reason,
      approvedBy: row.approved_by,
      ipAddress: row.ip_address,
      timestamp: new Date(row.created_at)
    }));
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data: operationsData } = await this.client
      .from(this.operationsTable)
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select();

    const { data: unmaskData } = await this.client
      .from(this.unmaskTable)
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select();

    return (operationsData?.length || 0) + (unmaskData?.length || 0);
  }
}

export default AuditLogger;
