/**
 * RLSValidator Unit Tests
 */

import { RLSValidator } from '../RLSValidator';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
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
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn()
    },
    _setResolveData: (data: any) => { resolveData = data; },
    _mockQueryBuilder: mockQueryBuilder
  };

  return mockClient as any;
};

describe('RLSValidator', () => {
  let validator: RLSValidator;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    validator = new RLSValidator(mockClient);
  });

  describe('canSelect', () => {
    it('should return allowed true when SELECT succeeds', async () => {
      mockClient._setResolveData({ error: null });

      const result = await validator.canSelect('users');

      expect(result.table).toBe('users');
      expect(result.operation).toBe('SELECT');
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return allowed false when SELECT fails', async () => {
      mockClient._setResolveData({ error: { message: 'Permission denied' } });

      const result = await validator.canSelect('users');

      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('canInsert', () => {
    it('should return assumed allowed for INSERT', async () => {
      const result = await validator.canInsert('users');

      expect(result.table).toBe('users');
      expect(result.operation).toBe('INSERT');
      expect(result.allowed).toBe(true);
      expect(result.policyName).toBe('assumed');
    });
  });

  describe('canUpdate', () => {
    it('should return assumed allowed for UPDATE', async () => {
      const result = await validator.canUpdate('users');

      expect(result.table).toBe('users');
      expect(result.operation).toBe('UPDATE');
      expect(result.allowed).toBe(true);
      expect(result.policyName).toBe('assumed');
    });
  });

  describe('canDelete', () => {
    it('should return assumed allowed for DELETE', async () => {
      const result = await validator.canDelete('users');

      expect(result.table).toBe('users');
      expect(result.operation).toBe('DELETE');
      expect(result.allowed).toBe(true);
      expect(result.policyName).toBe('assumed');
    });
  });

  describe('checkTablePermissions', () => {
    it('should check all CRUD permissions for a table', async () => {
      mockClient._setResolveData({ error: null });

      const perms = await validator.checkTablePermissions('users');

      expect(perms.table).toBe('users');
      expect(perms.canSelect).toBe(true);
      expect(perms.canInsert).toBe(true);
      expect(perms.canUpdate).toBe(true);
      expect(perms.canDelete).toBe(true);
      expect(perms.rlsEnabled).toBe(true);
      expect(perms.policies).toEqual([]);
    });

    it('should reflect SELECT failure in permissions', async () => {
      mockClient._setResolveData({ error: { message: 'Permission denied' } });

      const perms = await validator.checkTablePermissions('restricted');

      expect(perms.canSelect).toBe(false);
    });
  });

  describe('checkMultipleTablePermissions', () => {
    it('should check permissions for multiple tables', async () => {
      mockClient._setResolveData({ error: null });

      const results = await validator.checkMultipleTablePermissions(['users', 'orders', 'products']);

      expect(results.size).toBe(3);
      expect(results.get('users')?.table).toBe('users');
      expect(results.get('orders')?.table).toBe('orders');
      expect(results.get('products')?.table).toBe('products');
    });

    it('should handle mixed permission results', async () => {
      mockClient._setResolveData({ error: null });

      const results = await validator.checkMultipleTablePermissions(['users', 'restricted']);

      expect(results.get('users')?.canSelect).toBe(true);
    });
  });

  describe('validateImportPermissions', () => {
    it('should validate import permissions successfully', async () => {
      mockClient._setResolveData({ error: null });

      const validation = await validator.validateImportPermissions('users');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report SELECT error on target table', async () => {
      mockClient._setResolveData({ error: { message: 'No SELECT permission' } });

      const validation = await validator.validateImportPermissions('users');

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Cannot SELECT from target table 'users'");
    });

    it('should check lookup table permissions', async () => {
      // Testing that lookup tables are checked (will use same mock returning null error for simplicity)
      mockClient._setResolveData({ error: null });

      const validation = await validator.validateImportPermissions('orders', ['users']);

      // With no errors, validation should be valid
      expect(validation.valid).toBe(true);
    });
  });

  describe('validateExportPermissions', () => {
    it('should validate export permissions successfully', async () => {
      mockClient._setResolveData({ error: null });

      const validation = await validator.validateExportPermissions('users');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report SELECT error for export', async () => {
      mockClient._setResolveData({ error: { message: 'Permission denied' } });

      const validation = await validator.validateExportPermissions('users');

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Cannot SELECT from source table 'users'");
    });
  });

  describe('getRLSPolicies', () => {
    it('should return RLS policies via RPC', async () => {
      const mockPolicies = [
        { policyName: 'user_select', command: 'SELECT', roles: ['user'], using: 'true', withCheck: '' }
      ];
      mockClient.rpc.mockResolvedValue({ data: mockPolicies, error: null });

      const policies = await validator.getRLSPolicies('users');

      expect(mockClient.rpc).toHaveBeenCalledWith('get_rls_policies', {
        p_table_name: 'users',
        p_schema_name: 'public'
      });
      expect(policies).toEqual(mockPolicies);
    });

    it('should return empty array on RPC error', async () => {
      mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } });

      const policies = await validator.getRLSPolicies('users');

      expect(policies).toEqual([]);
    });

    it('should return empty array on RPC exception', async () => {
      mockClient.rpc.mockRejectedValue(new Error('Network error'));

      const policies = await validator.getRLSPolicies('users');

      expect(policies).toEqual([]);
    });

    it('should use custom schema', async () => {
      mockClient.rpc.mockResolvedValue({ data: [], error: null });

      await validator.getRLSPolicies('users', 'private');

      expect(mockClient.rpc).toHaveBeenCalledWith('get_rls_policies', {
        p_table_name: 'users',
        p_schema_name: 'private'
      });
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when session exists', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } }
      });

      const isAuth = await validator.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false when no session', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null }
      });

      const isAuth = await validator.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });

  describe('getCurrentUserId', () => {
    it('should return user ID when authenticated', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } }
      });

      const userId = await validator.getCurrentUserId();

      expect(userId).toBe('user-123');
    });

    it('should return null when not authenticated', async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null }
      });

      const userId = await validator.getCurrentUserId();

      expect(userId).toBeNull();
    });
  });

  describe('userHasRole', () => {
    it('should return true when RPC confirms role', async () => {
      mockClient.rpc.mockResolvedValue({ data: true, error: null });

      const hasRole = await validator.userHasRole('admin');

      expect(mockClient.rpc).toHaveBeenCalledWith('user_has_role', { role_name: 'admin' });
      expect(hasRole).toBe(true);
    });

    it('should return false when RPC denies role', async () => {
      mockClient.rpc.mockResolvedValue({ data: false, error: null });

      const hasRole = await validator.userHasRole('admin');

      expect(hasRole).toBe(false);
    });

    it('should return true when RPC function does not exist', async () => {
      mockClient.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } });

      const hasRole = await validator.userHasRole('admin');

      expect(hasRole).toBe(true);
    });

    it('should return true on RPC exception', async () => {
      mockClient.rpc.mockRejectedValue(new Error('Network error'));

      const hasRole = await validator.userHasRole('admin');

      expect(hasRole).toBe(true);
    });
  });

  describe('userHasAnyRole', () => {
    it('should return true if user has any of the roles', async () => {
      mockClient.rpc.mockImplementation((_fn: string, params: { role_name: string }) => {
        return Promise.resolve({ data: params.role_name === 'user', error: null });
      });

      const hasAny = await validator.userHasAnyRole(['admin', 'user']);

      expect(hasAny).toBe(true);
    });

    it('should return false if user has none of the roles', async () => {
      mockClient.rpc.mockResolvedValue({ data: false, error: null });

      const hasAny = await validator.userHasAnyRole(['admin', 'manager']);

      expect(hasAny).toBe(false);
    });

    it('should short-circuit on first matching role', async () => {
      mockClient.rpc.mockResolvedValue({ data: true, error: null });

      await validator.userHasAnyRole(['admin', 'manager', 'user']);

      expect(mockClient.rpc).toHaveBeenCalledTimes(1);
    });
  });
});
