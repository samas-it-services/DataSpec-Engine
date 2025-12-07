/**
 * Tests for Entity Operation Modes and Permissions
 *
 * Tests the OperationMode enum and permission checking functions
 */

import {
  OperationMode,
  EntityDefinition,
  EntityCategory,
  isOperationAllowedByMode,
  hasEntityPermission
} from '../types/spec.types';

describe('OperationMode', () => {
  describe('enum values', () => {
    it('should have correct string values', () => {
      expect(OperationMode.FULL).toBe('full');
      expect(OperationMode.EXPORT_ONLY).toBe('export_only');
      expect(OperationMode.VIEW_ONLY).toBe('view_only');
      expect(OperationMode.IMPORT_ONLY).toBe('import_only');
    });
  });

  describe('isOperationAllowedByMode', () => {
    describe('FULL mode', () => {
      it('should allow view operation', () => {
        expect(isOperationAllowedByMode(OperationMode.FULL, 'view')).toBe(true);
      });

      it('should allow import operation', () => {
        expect(isOperationAllowedByMode(OperationMode.FULL, 'import')).toBe(true);
      });

      it('should allow export operation', () => {
        expect(isOperationAllowedByMode(OperationMode.FULL, 'export')).toBe(true);
      });
    });

    describe('EXPORT_ONLY mode', () => {
      it('should allow view operation', () => {
        expect(isOperationAllowedByMode(OperationMode.EXPORT_ONLY, 'view')).toBe(true);
      });

      it('should deny import operation', () => {
        expect(isOperationAllowedByMode(OperationMode.EXPORT_ONLY, 'import')).toBe(false);
      });

      it('should allow export operation', () => {
        expect(isOperationAllowedByMode(OperationMode.EXPORT_ONLY, 'export')).toBe(true);
      });
    });

    describe('VIEW_ONLY mode', () => {
      it('should allow view operation', () => {
        expect(isOperationAllowedByMode(OperationMode.VIEW_ONLY, 'view')).toBe(true);
      });

      it('should deny import operation', () => {
        expect(isOperationAllowedByMode(OperationMode.VIEW_ONLY, 'import')).toBe(false);
      });

      it('should deny export operation', () => {
        expect(isOperationAllowedByMode(OperationMode.VIEW_ONLY, 'export')).toBe(false);
      });
    });

    describe('IMPORT_ONLY mode', () => {
      it('should allow view operation', () => {
        expect(isOperationAllowedByMode(OperationMode.IMPORT_ONLY, 'view')).toBe(true);
      });

      it('should allow import operation', () => {
        expect(isOperationAllowedByMode(OperationMode.IMPORT_ONLY, 'import')).toBe(true);
      });

      it('should deny export operation', () => {
        expect(isOperationAllowedByMode(OperationMode.IMPORT_ONLY, 'export')).toBe(false);
      });
    });

    describe('invalid mode', () => {
      it('should return false for unknown mode', () => {
        expect(isOperationAllowedByMode('unknown' as OperationMode, 'view')).toBe(false);
      });
    });
  });
});

describe('EntityPermissions', () => {
  // Helper function to create a test entity
  const createTestEntity = (
    overrides: Partial<EntityDefinition> = {}
  ): EntityDefinition => ({
    id: 'test-id',
    name: 'test_entity',
    displayName: 'Test Entity',
    tableName: 'test_entity',
    operationMode: OperationMode.FULL,
    permissions: {
      viewRoles: ['admin', 'user'],
      importRoles: ['admin'],
      exportRoles: ['admin', 'finance_incharge']
    },
    enabled: true,
    ...overrides
  });

  describe('hasEntityPermission', () => {
    describe('view operation', () => {
      it('should return true when user has view role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'view', ['user'])).toBe(true);
      });

      it('should return true when user has admin role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'view', ['admin'])).toBe(true);
      });

      it('should return false when user lacks view role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'view', ['guest'])).toBe(false);
      });

      it('should return true with multiple roles when one matches', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'view', ['guest', 'user'])).toBe(true);
      });
    });

    describe('import operation', () => {
      it('should return true when user has import role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'import', ['admin'])).toBe(true);
      });

      it('should return false when user lacks import role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'import', ['user'])).toBe(false);
      });

      it('should return false for export_only mode even with role', () => {
        const entity = createTestEntity({
          operationMode: OperationMode.EXPORT_ONLY,
          permissions: {
            viewRoles: ['admin'],
            importRoles: ['admin'],
            exportRoles: ['admin']
          }
        });
        expect(hasEntityPermission(entity, 'import', ['admin'])).toBe(false);
      });

      it('should return false for view_only mode even with role', () => {
        const entity = createTestEntity({
          operationMode: OperationMode.VIEW_ONLY,
          permissions: {
            viewRoles: ['admin'],
            importRoles: ['admin'],
            exportRoles: ['admin']
          }
        });
        expect(hasEntityPermission(entity, 'import', ['admin'])).toBe(false);
      });
    });

    describe('export operation', () => {
      it('should return true when user has export role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'export', ['admin'])).toBe(true);
      });

      it('should return true when user has finance_incharge role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'export', ['finance_incharge'])).toBe(true);
      });

      it('should return false when user lacks export role', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'export', ['user'])).toBe(false);
      });

      it('should return false for view_only mode even with role', () => {
        const entity = createTestEntity({
          operationMode: OperationMode.VIEW_ONLY,
          permissions: {
            viewRoles: ['admin'],
            importRoles: ['admin'],
            exportRoles: ['admin']
          }
        });
        expect(hasEntityPermission(entity, 'export', ['admin'])).toBe(false);
      });

      it('should return false for import_only mode even with role', () => {
        const entity = createTestEntity({
          operationMode: OperationMode.IMPORT_ONLY,
          permissions: {
            viewRoles: ['admin'],
            importRoles: ['admin'],
            exportRoles: ['admin']
          }
        });
        expect(hasEntityPermission(entity, 'export', ['admin'])).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty user roles', () => {
        const entity = createTestEntity();
        expect(hasEntityPermission(entity, 'view', [])).toBe(false);
      });

      it('should handle empty permission roles', () => {
        const entity = createTestEntity({
          permissions: {
            viewRoles: [],
            importRoles: [],
            exportRoles: []
          }
        });
        expect(hasEntityPermission(entity, 'view', ['admin'])).toBe(false);
      });

      it('should handle super_admin role', () => {
        const entity = createTestEntity({
          permissions: {
            viewRoles: ['super_admin'],
            importRoles: ['super_admin'],
            exportRoles: ['super_admin']
          }
        });
        expect(hasEntityPermission(entity, 'view', ['super_admin'])).toBe(true);
        expect(hasEntityPermission(entity, 'import', ['super_admin'])).toBe(true);
        expect(hasEntityPermission(entity, 'export', ['super_admin'])).toBe(true);
      });
    });
  });
});

describe('EntityCategory', () => {
  it('should have correct string values', () => {
    expect(EntityCategory.CORE).toBe('core');
    expect(EntityCategory.FINANCIAL).toBe('financial');
    expect(EntityCategory.AUDIT).toBe('audit');
    expect(EntityCategory.SYSTEM).toBe('system');
    expect(EntityCategory.LINK).toBe('link');
    expect(EntityCategory.GENERAL).toBe('general');
  });
});

describe('Real-world scenarios', () => {
  describe('Audit table (export_only)', () => {
    const auditEntity: EntityDefinition = {
      id: 'audit-1',
      name: 'transaction_audit',
      displayName: 'Transaction Audit',
      tableName: 'transaction_audit',
      operationMode: OperationMode.EXPORT_ONLY,
      permissions: {
        viewRoles: ['admin', 'finance_incharge', 'financial_auditor'],
        importRoles: [], // No one can import to audit tables
        exportRoles: ['admin', 'super_admin', 'financial_auditor']
      },
      category: EntityCategory.AUDIT,
      enabled: true
    };

    it('should allow financial_auditor to view', () => {
      expect(hasEntityPermission(auditEntity, 'view', ['financial_auditor'])).toBe(true);
    });

    it('should allow financial_auditor to export', () => {
      expect(hasEntityPermission(auditEntity, 'export', ['financial_auditor'])).toBe(true);
    });

    it('should deny import even to admin', () => {
      expect(hasEntityPermission(auditEntity, 'import', ['admin'])).toBe(false);
    });

    it('should deny export to regular user', () => {
      expect(hasEntityPermission(auditEntity, 'export', ['user'])).toBe(false);
    });
  });

  describe('System table (view_only)', () => {
    const systemEntity: EntityDefinition = {
      id: 'system-1',
      name: 'user_roles',
      displayName: 'User Roles',
      tableName: 'user_roles',
      operationMode: OperationMode.VIEW_ONLY,
      permissions: {
        viewRoles: ['super_admin'],
        importRoles: ['super_admin'],
        exportRoles: ['super_admin']
      },
      category: EntityCategory.SYSTEM,
      enabled: true
    };

    it('should allow super_admin to view', () => {
      expect(hasEntityPermission(systemEntity, 'view', ['super_admin'])).toBe(true);
    });

    it('should deny import even to super_admin due to mode', () => {
      expect(hasEntityPermission(systemEntity, 'import', ['super_admin'])).toBe(false);
    });

    it('should deny export even to super_admin due to mode', () => {
      expect(hasEntityPermission(systemEntity, 'export', ['super_admin'])).toBe(false);
    });
  });

  describe('Standard entity (full)', () => {
    const standardEntity: EntityDefinition = {
      id: 'entity-1',
      name: 'transactions',
      displayName: 'Transactions',
      tableName: 'transactions',
      operationMode: OperationMode.FULL,
      permissions: {
        viewRoles: ['admin', 'finance_incharge'],
        importRoles: ['admin'],
        exportRoles: ['admin', 'finance_incharge']
      },
      category: EntityCategory.FINANCIAL,
      enabled: true
    };

    it('should allow finance_incharge to view', () => {
      expect(hasEntityPermission(standardEntity, 'view', ['finance_incharge'])).toBe(true);
    });

    it('should deny finance_incharge to import', () => {
      expect(hasEntityPermission(standardEntity, 'import', ['finance_incharge'])).toBe(false);
    });

    it('should allow finance_incharge to export', () => {
      expect(hasEntityPermission(standardEntity, 'export', ['finance_incharge'])).toBe(true);
    });

    it('should allow admin all operations', () => {
      expect(hasEntityPermission(standardEntity, 'view', ['admin'])).toBe(true);
      expect(hasEntityPermission(standardEntity, 'import', ['admin'])).toBe(true);
      expect(hasEntityPermission(standardEntity, 'export', ['admin'])).toBe(true);
    });
  });
});
