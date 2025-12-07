/**
 * AuditLogger Unit Tests
 */

import {
  AuditLogger,
  AuditLogEntry,
  UnmaskAuditEntry,
  AuditEventType
} from '../AuditLogger';
import { OperationStatus } from '@dataspec-engine/core';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  let resolveData: any = { data: [], error: null };

  const asyncMockBuilder = new Proxy(mockQueryBuilder, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: any) => resolve(resolveData);
      }
      const value = target[prop as keyof typeof mockQueryBuilder];
      if (typeof value === 'function') {
        return (...args: any[]) => {
          value(...args);
          return asyncMockBuilder;
        };
      }
      return value;
    }
  });

  const mockClient = {
    from: jest.fn(() => asyncMockBuilder),
    _setResolveData: (data: any) => { resolveData = data; },
    _mockQueryBuilder: mockQueryBuilder
  };

  return mockClient as any;
};

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    logger = new AuditLogger(mockClient);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default options', () => {
      const logger = new AuditLogger(mockClient);
      expect(logger).toBeDefined();
    });

    it('should create logger with custom options', () => {
      const logger = new AuditLogger(mockClient, {
        operationsTable: 'custom_ops',
        unmaskTable: 'custom_unmask',
        enableConsoleLogging: true,
        retentionDays: 90
      });
      expect(logger).toBeDefined();
    });
  });

  describe('log', () => {
    it('should log audit entry to database', async () => {
      mockClient._setResolveData({ error: null });

      const entry: AuditLogEntry = {
        eventType: AuditEventType.IMPORT_STARTED,
        entityType: 'users',
        executionId: 'exec-123',
        status: OperationStatus.SUCCESS,
        createdAt: new Date('2024-01-15T10:00:00Z')
      };

      await logger.log(entry);

      expect(mockClient.from).toHaveBeenCalledWith('dataspec_operation_logs');
      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'import_started',
          entity_type: 'users',
          execution_id: 'exec-123',
          status: 'success'
        })
      );
    });

    it('should log to console when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockClient._setResolveData({ error: null });

      const loggerWithConsole = new AuditLogger(mockClient, { enableConsoleLogging: true });

      await loggerWithConsole.log({
        eventType: AuditEventType.IMPORT_STARTED,
        entityType: 'users',
        executionId: 'exec-123',
        status: OperationStatus.SUCCESS,
        createdAt: new Date()
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AUDIT] import_started:',
        expect.any(Object)
      );
      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClient._setResolveData({ error: { message: 'Insert failed' } });

      await logger.log({
        eventType: AuditEventType.IMPORT_FAILED,
        entityType: 'users',
        executionId: 'exec-123',
        status: OperationStatus.ERROR,
        createdAt: new Date()
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to write audit log:', 'Insert failed');
      consoleSpy.mockRestore();
    });

    it('should include all optional fields', async () => {
      mockClient._setResolveData({ error: null });

      const entry: AuditLogEntry = {
        eventType: AuditEventType.IMPORT_COMPLETED,
        entityType: 'users',
        entityId: 'entity-1',
        specId: 'spec-1',
        specName: 'User Import',
        executionId: 'exec-123',
        userId: 'user-1',
        userEmail: 'test@example.com',
        userRoles: ['admin', 'user'],
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: OperationStatus.SUCCESS,
        recordsAffected: 100,
        executionTimeMs: 1500,
        errorMessage: undefined,
        errorDetails: undefined,
        metadata: { source: 'csv' },
        createdAt: new Date('2024-01-15T10:00:00Z')
      };

      await logger.log(entry);

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_id: 'entity-1',
          spec_id: 'spec-1',
          spec_name: 'User Import',
          user_id: 'user-1',
          user_email: 'test@example.com',
          user_roles: ['admin', 'user'],
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          records_affected: 100,
          execution_time_ms: 1500,
          metadata: { source: 'csv' }
        })
      );
    });
  });

  describe('logImportStarted', () => {
    it('should log import started event', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logImportStarted({
        entityType: 'users',
        specId: 'spec-1',
        specName: 'User Import',
        executionId: 'exec-123',
        userId: 'user-1',
        totalRecords: 500,
        metadata: { fileName: 'users.csv' }
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'import_started',
          entity_type: 'users',
          records_affected: 500
        })
      );
    });
  });

  describe('logImportCompleted', () => {
    it('should log import completed with success status', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logImportCompleted({
        entityType: 'users',
        specId: 'spec-1',
        specName: 'User Import',
        executionId: 'exec-123',
        userId: 'user-1',
        successfulRecords: 98,
        failedRecords: 0,
        executionTimeMs: 2500,
        metadata: {}
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'import_completed',
          status: 'success',
          records_affected: 98
        })
      );
    });

    it('should log import completed with warning status when failures exist', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logImportCompleted({
        entityType: 'users',
        executionId: 'exec-123',
        successfulRecords: 95,
        failedRecords: 5,
        executionTimeMs: 3000
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'warning',
          records_affected: 100,
          metadata: expect.objectContaining({
            successfulRecords: 95,
            failedRecords: 5
          })
        })
      );
    });
  });

  describe('logImportFailed', () => {
    it('should log import failed event', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logImportFailed({
        entityType: 'users',
        specId: 'spec-1',
        specName: 'User Import',
        executionId: 'exec-123',
        userId: 'user-1',
        errorMessage: 'File parsing failed',
        errorDetails: { line: 10, error: 'Invalid CSV format' },
        executionTimeMs: 500
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'import_failed',
          status: 'error',
          error_message: 'File parsing failed',
          error_details: { line: 10, error: 'Invalid CSV format' }
        })
      );
    });
  });

  describe('logExportStarted', () => {
    it('should log export started event', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logExportStarted({
        entityType: 'users',
        specId: 'spec-1',
        specName: 'User Export',
        executionId: 'exec-123',
        userId: 'user-1',
        format: 'csv',
        filters: { status: 'active' }
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'export_started',
          metadata: expect.objectContaining({
            format: 'csv',
            filters: { status: 'active' }
          })
        })
      );
    });
  });

  describe('logExportCompleted', () => {
    it('should log export completed event', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logExportCompleted({
        entityType: 'users',
        specId: 'spec-1',
        specName: 'User Export',
        executionId: 'exec-123',
        userId: 'user-1',
        recordsExported: 250,
        maskingApplied: true,
        maskedFields: ['ssn', 'email'],
        executionTimeMs: 1200
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'export_completed',
          records_affected: 250,
          metadata: expect.objectContaining({
            maskingApplied: true,
            maskedFields: ['ssn', 'email']
          })
        })
      );
    });
  });

  describe('logUnmask', () => {
    it('should log unmask event', async () => {
      mockClient._setResolveData({ error: null });

      const entry: UnmaskAuditEntry = {
        fieldName: 'ssn',
        tableName: 'users',
        recordId: 'user-123',
        userId: 'admin-1',
        userRoles: ['admin'],
        reason: 'Customer support request',
        approvedBy: 'supervisor-1',
        ipAddress: '192.168.1.1',
        timestamp: new Date('2024-01-15T10:00:00Z')
      };

      await logger.logUnmask(entry);

      expect(mockClient.from).toHaveBeenCalledWith('dataspec_unmask_logs');
      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          field_name: 'ssn',
          table_name: 'users',
          record_id: 'user-123',
          user_id: 'admin-1',
          user_roles: ['admin'],
          reason: 'Customer support request',
          approved_by: 'supervisor-1'
        })
      );
    });

    it('should log to console when enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockClient._setResolveData({ error: null });

      const loggerWithConsole = new AuditLogger(mockClient, { enableConsoleLogging: true });

      await loggerWithConsole.logUnmask({
        fieldName: 'ssn',
        tableName: 'users',
        recordId: 'user-123',
        userId: 'admin-1',
        userRoles: ['admin'],
        timestamp: new Date()
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AUDIT] Data Unmasked:',
        expect.objectContaining({
          field: 'ssn',
          table: 'users'
        })
      );
      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClient._setResolveData({ error: { message: 'Insert failed' } });

      await logger.logUnmask({
        fieldName: 'ssn',
        tableName: 'users',
        recordId: 'user-123',
        userId: 'admin-1',
        userRoles: ['admin'],
        timestamp: new Date()
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to write unmask audit log:', 'Insert failed');
      consoleSpy.mockRestore();
    });
  });

  describe('logPermissionDenied', () => {
    it('should log permission denied event', async () => {
      mockClient._setResolveData({ error: null });

      await logger.logPermissionDenied({
        entityType: 'users',
        operation: 'export',
        userId: 'user-1',
        userRoles: ['guest'],
        requiredPermissions: ['admin', 'manager']
      });

      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'permission_denied',
          status: 'error',
          metadata: expect.objectContaining({
            operation: 'export',
            requiredPermissions: ['admin', 'manager']
          })
        })
      );
    });
  });

  describe('getRecentLogs', () => {
    it('should fetch recent logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          event_type: 'import_completed',
          entity_type: 'users',
          execution_id: 'exec-1',
          status: 'success',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'log-2',
          event_type: 'export_started',
          entity_type: 'users',
          execution_id: 'exec-2',
          status: 'success',
          created_at: '2024-01-15T09:00:00Z'
        }
      ];
      mockClient._setResolveData({ data: mockLogs, error: null });

      const logs = await logger.getRecentLogs({ limit: 10 });

      expect(mockClient.from).toHaveBeenCalledWith('dataspec_operation_logs');
      expect(mockClient._mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockClient._mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(logs).toHaveLength(2);
      expect(logs[0].eventType).toBe('import_completed');
    });

    it('should filter by entity type', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await logger.getRecentLogs({ entityType: 'users' });

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('entity_type', 'users');
    });

    it('should filter by user ID', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await logger.getRecentLogs({ userId: 'user-123' });

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should filter by event type', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await logger.getRecentLogs({ eventType: AuditEventType.IMPORT_COMPLETED });

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('event_type', 'import_completed');
    });

    it('should filter by date', async () => {
      mockClient._setResolveData({ data: [], error: null });
      const since = new Date('2024-01-01');

      await logger.getRecentLogs({ since });

      expect(mockClient._mockQueryBuilder.gte).toHaveBeenCalledWith('created_at', since.toISOString());
    });

    it('should throw error on database failure', async () => {
      mockClient._setResolveData({ data: null, error: { message: 'Query failed' } });

      await expect(logger.getRecentLogs({})).rejects.toThrow('Failed to fetch audit logs: Query failed');
    });

    it('should return empty array when data is null', async () => {
      mockClient._setResolveData({ data: null, error: null });

      const logs = await logger.getRecentLogs({});

      expect(logs).toEqual([]);
    });
  });

  describe('getUnmaskLogs', () => {
    it('should fetch unmask logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          field_name: 'ssn',
          table_name: 'users',
          record_id: 'user-1',
          user_id: 'admin-1',
          user_roles: ['admin'],
          reason: 'Support request',
          created_at: '2024-01-15T10:00:00Z'
        }
      ];
      mockClient._setResolveData({ data: mockLogs, error: null });

      const logs = await logger.getUnmaskLogs({ limit: 10 });

      expect(mockClient.from).toHaveBeenCalledWith('dataspec_unmask_logs');
      expect(logs).toHaveLength(1);
      expect(logs[0].fieldName).toBe('ssn');
    });

    it('should filter by field name', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await logger.getUnmaskLogs({ fieldName: 'ssn' });

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('field_name', 'ssn');
    });

    it('should filter by table name', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await logger.getUnmaskLogs({ tableName: 'users' });

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('table_name', 'users');
    });

    it('should filter by user ID', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await logger.getUnmaskLogs({ userId: 'admin-1' });

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'admin-1');
    });

    it('should filter by date', async () => {
      mockClient._setResolveData({ data: [], error: null });
      const since = new Date('2024-01-01');

      await logger.getUnmaskLogs({ since });

      expect(mockClient._mockQueryBuilder.gte).toHaveBeenCalledWith('created_at', since.toISOString());
    });

    it('should throw error on database failure', async () => {
      mockClient._setResolveData({ data: null, error: { message: 'Query failed' } });

      await expect(logger.getUnmaskLogs({})).rejects.toThrow('Failed to fetch unmask logs: Query failed');
    });
  });

  describe('cleanupOldLogs', () => {
    it('should cleanup logs older than retention period', async () => {
      // Mock data array with 50 items
      const mockData = Array(50).fill({}).map((_, i) => ({ id: i }));
      mockClient._setResolveData({ data: mockData });

      const deleted = await logger.cleanupOldLogs(90);

      expect(mockClient.from).toHaveBeenCalledWith('dataspec_operation_logs');
      expect(mockClient.from).toHaveBeenCalledWith('dataspec_unmask_logs');
      expect(mockClient._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockClient._mockQueryBuilder.lt).toHaveBeenCalled();
      expect(deleted).toBe(100); // 50 from each table
    });

    it('should return 0 when no logs deleted', async () => {
      mockClient._setResolveData({ data: null });

      const deleted = await logger.cleanupOldLogs(90);

      expect(deleted).toBe(0);
    });
  });

  describe('custom table names', () => {
    it('should use custom operations table', async () => {
      const customLogger = new AuditLogger(mockClient, {
        operationsTable: 'custom_ops_log'
      });
      mockClient._setResolveData({ error: null });

      await customLogger.log({
        eventType: AuditEventType.IMPORT_STARTED,
        entityType: 'users',
        executionId: 'exec-1',
        status: OperationStatus.SUCCESS,
        createdAt: new Date()
      });

      expect(mockClient.from).toHaveBeenCalledWith('custom_ops_log');
    });

    it('should use custom unmask table', async () => {
      const customLogger = new AuditLogger(mockClient, {
        unmaskTable: 'custom_unmask_log'
      });
      mockClient._setResolveData({ error: null });

      await customLogger.logUnmask({
        fieldName: 'ssn',
        tableName: 'users',
        recordId: 'user-1',
        userId: 'admin-1',
        userRoles: ['admin'],
        timestamp: new Date()
      });

      expect(mockClient.from).toHaveBeenCalledWith('custom_unmask_log');
    });
  });
});

describe('AuditEventType', () => {
  it('should have all required event types', () => {
    expect(AuditEventType.IMPORT_STARTED).toBe('import_started');
    expect(AuditEventType.IMPORT_COMPLETED).toBe('import_completed');
    expect(AuditEventType.IMPORT_FAILED).toBe('import_failed');
    expect(AuditEventType.EXPORT_STARTED).toBe('export_started');
    expect(AuditEventType.EXPORT_COMPLETED).toBe('export_completed');
    expect(AuditEventType.EXPORT_FAILED).toBe('export_failed');
    expect(AuditEventType.DATA_UNMASKED).toBe('data_unmasked');
    expect(AuditEventType.SPEC_CREATED).toBe('spec_created');
    expect(AuditEventType.SPEC_UPDATED).toBe('spec_updated');
    expect(AuditEventType.SPEC_DELETED).toBe('spec_deleted');
    expect(AuditEventType.PERMISSION_DENIED).toBe('permission_denied');
    expect(AuditEventType.VALIDATION_FAILED).toBe('validation_failed');
  });
});
