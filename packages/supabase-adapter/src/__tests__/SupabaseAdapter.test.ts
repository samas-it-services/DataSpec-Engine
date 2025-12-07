/**
 * SupabaseAdapter Unit Tests
 */

import { SupabaseAdapter, DatabaseError } from '../SupabaseAdapter';
import { QueryBuilder, OperationStatus } from '@dataspec-engine/core';

// Helper to create QueryBuilder with optional fields
const createQuery = (overrides: Partial<QueryBuilder> = {}): QueryBuilder => ({
  select: '*',
  filters: [],
  ...overrides
});

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
  };

  // Store reference to resolve promises later
  let resolveData: any = { data: [], error: null };

  // Make the mock async by returning a promise
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
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn()
    },
    _setResolveData: (data: any) => { resolveData = data; },
    _mockQueryBuilder: mockQueryBuilder
  };

  return mockClient as any;
};

describe('SupabaseAdapter', () => {
  let adapter: SupabaseAdapter;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    adapter = new SupabaseAdapter(mockClient);
  });

  describe('constructor', () => {
    it('should create adapter with default options', () => {
      const adapter = new SupabaseAdapter(mockClient);
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom options', () => {
      const adapter = new SupabaseAdapter(mockClient, {
        auditTable: 'custom_audit',
        enableRLS: true,
        defaultSchema: 'private'
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('setUser', () => {
    it('should set user context', () => {
      adapter.setUser('user-123', ['admin', 'manager']);

      expect(adapter.getUserId()).toBe('user-123');
      expect(adapter.getUserRoles()).toEqual(['admin', 'manager']);
    });

    it('should return copy of roles array', () => {
      adapter.setUser('user-123', ['admin']);
      const roles = adapter.getUserRoles();
      roles.push('hacker');

      expect(adapter.getUserRoles()).toEqual(['admin']);
    });
  });

  describe('find', () => {
    it('should find records with basic query', async () => {
      const mockData = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' }
      ];
      mockClient._setResolveData({ data: mockData, error: null });

      const results = await adapter.find('users', createQuery());

      expect(mockClient.from).toHaveBeenCalledWith('users');
      expect(results).toEqual(mockData);
    });

    it('should apply select clause', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await adapter.find('users', createQuery({ select: 'id, name' }));

      expect(mockClient._mockQueryBuilder.select).toHaveBeenCalledWith('id, name');
    });

    it('should apply filters', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await adapter.find('users', createQuery({
        filters: [
          { field: 'status', operator: '=', value: 'active' },
          { field: 'age', operator: '>', value: 18 }
        ]
      }));

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockClient._mockQueryBuilder.gt).toHaveBeenCalledWith('age', 18);
    });

    it('should apply ordering', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await adapter.find('users', createQuery({
        orderBy: [
          { field: 'created_at', direction: 'desc' },
          { field: 'name', direction: 'asc' }
        ]
      }));

      expect(mockClient._mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockClient._mockQueryBuilder.order).toHaveBeenCalledWith('name', { ascending: true });
    });

    it('should apply limit', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await adapter.find('users', createQuery({ limit: 10 }));

      expect(mockClient._mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should apply offset with range', async () => {
      mockClient._setResolveData({ data: [], error: null });

      await adapter.find('users', createQuery({ offset: 20, limit: 10 }));

      expect(mockClient._mockQueryBuilder.range).toHaveBeenCalledWith(20, 29);
    });

    it('should throw DatabaseError on error', async () => {
      mockClient._setResolveData({
        data: null,
        error: { message: 'Query failed', code: 'ERR001', details: 'Some details' }
      });

      await expect(adapter.find('users', createQuery())).rejects.toThrow(DatabaseError);
    });

    it('should return empty array when data is null', async () => {
      mockClient._setResolveData({ data: null, error: null });

      const results = await adapter.find('users', createQuery());

      expect(results).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should find single record', async () => {
      const mockData = { id: '1', name: 'User 1' };
      mockClient._setResolveData({ data: mockData, error: null });

      const result = await adapter.findOne('users', createQuery({
        filters: [{ field: 'id', operator: '=', value: '1' }]
      }));

      expect(mockClient._mockQueryBuilder.limit).toHaveBeenCalledWith(1);
      expect(mockClient._mockQueryBuilder.single).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should return null when no rows found (PGRST116)', async () => {
      mockClient._setResolveData({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' }
      });

      const result = await adapter.findOne('users', createQuery({
        filters: [{ field: 'id', operator: '=', value: 'nonexistent' }]
      }));

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockClient._setResolveData({
        data: null,
        error: { message: 'Database error', code: 'ERR500' }
      });

      await expect(adapter.findOne('users', createQuery())).rejects.toThrow(DatabaseError);
    });
  });

  describe('insert', () => {
    it('should insert records successfully', async () => {
      const rows = [{ name: 'User 1' }, { name: 'User 2' }];
      const insertedData = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' }
      ];
      mockClient._setResolveData({ data: insertedData, error: null });

      const result = await adapter.insert('users', rows);

      expect(mockClient.from).toHaveBeenCalledWith('users');
      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalledWith(rows);
      expect(result.insertedCount).toBe(2);
      expect(result.insertedIds).toEqual(['1', '2']);
    });

    it('should return empty result for empty rows', async () => {
      const result = await adapter.insert('users', []);

      expect(result.insertedCount).toBe(0);
      expect(result.insertedIds).toEqual([]);
    });

    it('should return error on insert failure', async () => {
      const rows = [{ name: 'User 1' }];
      mockClient._setResolveData({
        data: null,
        error: { message: 'Insert failed' }
      });

      const result = await adapter.insert('users', rows);

      expect(result.insertedCount).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toBe('Insert failed');
    });
  });

  describe('update', () => {
    it('should update records successfully', async () => {
      const updates = [{ name: 'Updated User' }];
      mockClient._setResolveData({ data: null, error: null, count: 1 });

      const result = await adapter.update('users', updates, createQuery({
        filters: [{ field: 'id', operator: '=', value: '1' }]
      }));

      expect(mockClient._mockQueryBuilder.update).toHaveBeenCalledWith(updates[0]);
      expect(result.updatedCount).toBe(1);
    });

    it('should return empty result for empty updates', async () => {
      const result = await adapter.update('users', [], createQuery());

      expect(result.updatedCount).toBe(0);
    });

    it('should collect errors from failed updates', async () => {
      const updates = [{ name: 'User 1' }, { name: 'User 2' }];
      mockClient._setResolveData({ error: { message: 'Update failed' } });

      const result = await adapter.update('users', updates, createQuery());

      expect(result.errors).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete records successfully', async () => {
      mockClient._setResolveData({ error: null, count: 5 });

      const result = await adapter.delete('users', createQuery({
        filters: [{ field: 'status', operator: '=', value: 'inactive' }]
      }));

      expect(mockClient._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(result.deletedCount).toBe(5);
    });

    it('should return error on delete failure', async () => {
      mockClient._setResolveData({ error: { message: 'Delete failed' } });

      const result = await adapter.delete('users', createQuery());

      expect(result.deletedCount).toBe(0);
      expect(result.errors).toContain('Delete failed');
    });
  });

  describe('lookup', () => {
    it('should lookup by single key', async () => {
      const mockData = { id: '1', name: 'User 1' };
      mockClient._setResolveData({ data: mockData, error: null });

      const result = await adapter.lookup('users', 'id', '1');

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('id', '1');
      expect(mockClient._mockQueryBuilder.maybeSingle).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should lookup by composite key', async () => {
      const mockData = { org_id: 'org1', user_id: 'user1', role: 'admin' };
      mockClient._setResolveData({ data: mockData, error: null });

      const result = await adapter.lookup('memberships', ['org_id', 'user_id'], ['org1', 'user1']);

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('org_id', 'org1');
      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user1');
      expect(result).toEqual(mockData);
    });

    it('should throw DatabaseError on lookup failure', async () => {
      mockClient._setResolveData({
        data: null,
        error: { message: 'Lookup failed', code: 'ERR001' }
      });

      await expect(adapter.lookup('users', 'id', '1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('transaction', () => {
    it('should execute callback in transaction context', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);

      await adapter.transaction(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const error = new Error('Transaction failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(adapter.transaction(callback)).rejects.toThrow('Transaction failed');
    });
  });

  describe('logOperation', () => {
    it('should log operation successfully', async () => {
      mockClient._setResolveData({ error: null });

      await adapter.logOperation({
        operationType: 'import',
        specId: 'spec-1',
        specName: 'User Import',
        entity: 'users',
        executionId: 'exec-123',
        status: OperationStatus.SUCCESS,
        totalRecords: 100,
        successfulRecords: 98,
        failedRecords: 2,
        executionTime: 1500,
        timestamp: new Date('2024-01-15T10:00:00Z')
      });

      expect(mockClient.from).toHaveBeenCalledWith('dataspec_operation_logs');
      expect(mockClient._mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should not throw on logging failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClient._setResolveData({ error: { message: 'Log failed' } });

      await expect(adapter.logOperation({
        operationType: 'import',
        entity: 'users',
        executionId: 'exec-123',
        status: OperationStatus.SUCCESS,
        totalRecords: 100,
        successfulRecords: 100,
        failedRecords: 0,
        executionTime: 1000,
        timestamp: new Date()
      })).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('executeRpc', () => {
    it('should execute RPC function', async () => {
      mockClient.rpc.mockResolvedValue({ data: { result: 'success' }, error: null });

      const result = await adapter.executeRpc('my_function', { param1: 'value1' });

      expect(mockClient.rpc).toHaveBeenCalledWith('my_function', { param1: 'value1' });
      expect(result).toEqual({ result: 'success' });
    });

    it('should throw DatabaseError on RPC failure', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed', code: 'RPC001' }
      });

      await expect(adapter.executeRpc('my_function')).rejects.toThrow(DatabaseError);
    });
  });

  describe('tableExists', () => {
    it('should return true if table exists', async () => {
      mockClient._setResolveData({ error: null });

      const exists = await adapter.tableExists('users');

      expect(exists).toBe(true);
    });

    it('should return false if table does not exist', async () => {
      mockClient._setResolveData({ error: { message: 'Table not found' } });

      const exists = await adapter.tableExists('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('getTableColumns', () => {
    it('should return columns from sample row', async () => {
      mockClient._setResolveData({
        data: [{ id: '1', name: 'Test', email: 'test@example.com' }],
        error: null
      });

      const columns = await adapter.getTableColumns('users');

      expect(columns).toHaveLength(3);
      expect(columns[0].name).toBe('id');
      expect(columns[1].name).toBe('name');
      expect(columns[2].name).toBe('email');
    });

    it('should return empty array on error', async () => {
      mockClient._setResolveData({ data: null, error: { message: 'Error' } });

      const columns = await adapter.getTableColumns('nonexistent');

      expect(columns).toEqual([]);
    });

    it('should return empty array when table is empty', async () => {
      mockClient._setResolveData({ data: [], error: null });

      const columns = await adapter.getTableColumns('empty_table');

      expect(columns).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('should upsert records successfully', async () => {
      const rows = [{ id: '1', name: 'User 1' }];
      mockClient._setResolveData({
        data: [{ id: '1', name: 'User 1' }],
        error: null
      });

      const result = await adapter.upsert('users', rows, 'id');

      expect(mockClient._mockQueryBuilder.upsert).toHaveBeenCalledWith(rows, { onConflict: 'id' });
      expect(result.insertedCount).toBe(1);
    });

    it('should handle composite conflict columns', async () => {
      const rows = [{ org_id: 'org1', user_id: 'user1', role: 'admin' }];
      mockClient._setResolveData({ data: rows, error: null });

      await adapter.upsert('memberships', rows, ['org_id', 'user_id']);

      expect(mockClient._mockQueryBuilder.upsert).toHaveBeenCalledWith(rows, { onConflict: 'org_id,user_id' });
    });

    it('should return empty result for empty rows', async () => {
      const result = await adapter.upsert('users', [], 'id');

      expect(result.insertedCount).toBe(0);
    });

    it('should return error on upsert failure', async () => {
      mockClient._setResolveData({ data: null, error: { message: 'Upsert failed' } });

      const result = await adapter.upsert('users', [{ id: '1' }], 'id');

      expect(result.errors).toHaveLength(1);
    });
  });

  describe('count', () => {
    it('should count all records', async () => {
      mockClient._setResolveData({ count: 42, error: null });

      const count = await adapter.count('users');

      expect(mockClient._mockQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(count).toBe(42);
    });

    it('should count with filters', async () => {
      mockClient._setResolveData({ count: 10, error: null });

      const count = await adapter.count('users', createQuery({
        filters: [{ field: 'status', operator: '=', value: 'active' }]
      }));

      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'active');
      expect(count).toBe(10);
    });

    it('should throw DatabaseError on count failure', async () => {
      mockClient._setResolveData({ count: null, error: { message: 'Count failed' } });

      await expect(adapter.count('users')).rejects.toThrow(DatabaseError);
    });

    it('should return 0 when count is null', async () => {
      mockClient._setResolveData({ count: null, error: null });

      const count = await adapter.count('users');

      expect(count).toBe(0);
    });
  });

  describe('filter operators', () => {
    const testOperator = async (operator: string, expectedMethod: string) => {
      mockClient._setResolveData({ data: [], error: null });

      await adapter.find('users', createQuery({
        filters: [{ field: 'value', operator, value: 'test' }]
      }));

      expect(mockClient._mockQueryBuilder[expectedMethod]).toHaveBeenCalledWith('value', 'test');
    };

    it('should handle != operator', async () => {
      await testOperator('!=', 'neq');
    });

    it('should handle <> operator', async () => {
      mockClient._setResolveData({ data: [], error: null });
      await adapter.find('users', createQuery({
        filters: [{ field: 'value', operator: '<>', value: 'test' }]
      }));
      expect(mockClient._mockQueryBuilder.neq).toHaveBeenCalled();
    });

    it('should handle >= operator', async () => {
      await testOperator('>=', 'gte');
    });

    it('should handle < operator', async () => {
      await testOperator('<', 'lt');
    });

    it('should handle <= operator', async () => {
      await testOperator('<=', 'lte');
    });

    it('should handle LIKE operator', async () => {
      await testOperator('LIKE', 'like');
    });

    it('should handle ILIKE operator', async () => {
      await testOperator('ILIKE', 'ilike');
    });

    it('should handle IN operator', async () => {
      mockClient._setResolveData({ data: [], error: null });
      await adapter.find('users', createQuery({
        filters: [{ field: 'status', operator: 'IN', value: ['active', 'pending'] }]
      }));
      expect(mockClient._mockQueryBuilder.in).toHaveBeenCalledWith('status', ['active', 'pending']);
    });

    it('should handle IS operator', async () => {
      mockClient._setResolveData({ data: [], error: null });
      await adapter.find('users', createQuery({
        filters: [{ field: 'deleted_at', operator: 'IS', value: null }]
      }));
      expect(mockClient._mockQueryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should default to eq for unknown operators', async () => {
      mockClient._setResolveData({ data: [], error: null });
      await adapter.find('users', createQuery({
        filters: [{ field: 'value', operator: 'UNKNOWN', value: 'test' }]
      }));
      expect(mockClient._mockQueryBuilder.eq).toHaveBeenCalledWith('value', 'test');
    });
  });
});

describe('DatabaseError', () => {
  it('should create error with message only', () => {
    const error = new DatabaseError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('DatabaseError');
    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it('should create error with all properties', () => {
    const error = new DatabaseError('Test error', 'ERR001', { extra: 'info' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('ERR001');
    expect(error.details).toEqual({ extra: 'info' });
  });
});
